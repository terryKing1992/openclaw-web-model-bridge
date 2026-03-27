import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { loadConfig } from './config.js';
import { PluginStatus, WSMessage, MODEL_MAP, DOUBAO_BOT_ID } from './types/ws.js';
import { OpenAIChatRequest, OpenAIModelsResponse, OpenAIError } from './types/openai.js';
import { generateRequestId, formatSSE, formatOpenAIError } from './utils.js';
import { truncateMessages, buildDoubaoMessage } from './context.js';
import * as logger from './logger.js';

const app: express.Application = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const pluginStatus: PluginStatus = {
  connected: false,
  pageOpened: false,
  loggedIn: false,
  conversationId: null,
  model: 'doubao-fast',
};

const pendingRequests = new Map<string, {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
  chunks: string[];
  controller: AbortController;
}>();

let wsClient: WebSocket | null = null;

wss.on('connection', (ws) => {
  wsClient = ws;
  pluginStatus.connected = true;
  logger.info('插件已连接');
  
  ws.on('message', (data) => {
    try {
      const rawMsg = data.toString();
      logger.info(`收到WebSocket消息: ${rawMsg}`);
      const msg: WSMessage = JSON.parse(rawMsg);
      
      // 处理ping-pong
      if (msg.type === 'ping') {
        logger.info(`收到ping: timestamp=${msg.timestamp}`);
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        return;
      }
      
      handleMessage(msg);
    } catch (e) {
      logger.error('Failed to parse message: ' + e);
    }
  });
  
  ws.on('close', () => {
    wsClient = null;
    pluginStatus.connected = false;
    pluginStatus.pageOpened = false;
    pluginStatus.loggedIn = false;
    pluginStatus.conversationId = null;
    logger.info('插件已断开');
  });
  
  ws.send(JSON.stringify({ type: 'register', client: 'proxy-server' }));
});

function handleMessage(msg: WSMessage) {
  logger.info(`处理消息类型: ${msg.type}, request_id: ${msg.request_id || 'N/A'}`);
  
  if (msg.type === 'status') {
    pluginStatus.pageOpened = msg.pageOpened ?? true;
    pluginStatus.loggedIn = msg.loggedIn ?? msg.logged_in ?? false;
    pluginStatus.conversationId = msg.conversationId ?? msg.conversation_id ?? null;
    logger.info(`状态更新: pageOpened=${pluginStatus.pageOpened}, loggedIn=${pluginStatus.loggedIn}, conversationId=${pluginStatus.conversationId}`);
  } else if (msg.type === 'delta' && msg.request_id && msg.text) {
    logger.info(`收到delta: request_id=${msg.request_id}, text长度=${msg.text.length}, text=${msg.text.substring(0, 50)}...`);
    const pending = pendingRequests.get(msg.request_id);
    if (pending) {
      pending.chunks.push(msg.text);
      if (pending.resolve) {
        pending.resolve(msg.text);
      }
    }
  } else if (msg.type === 'done' && msg.request_id) {
    logger.info(`收到done: request_id=${msg.request_id}`);
    const pending = pendingRequests.get(msg.request_id);
    if (pending) {
      pending.resolve('');
      pendingRequests.delete(msg.request_id);
    }
  } else if (msg.type === 'error' && msg.request_id) {
    logger.error(`收到error: request_id=${msg.request_id}, message=${msg.message}`);
    const pending = pendingRequests.get(msg.request_id);
    if (pending) {
      pending.reject(new Error(msg.message || 'Unknown error'));
      pendingRequests.delete(msg.request_id);
    }
  } else if (msg.type === 'page_closed') {
    logger.info('收到page_closed');
    pluginStatus.pageOpened = false;
    pluginStatus.loggedIn = false;
    pluginStatus.conversationId = null;
  } else {
    logger.info(`收到未知类型消息: ${JSON.stringify(msg)}`);
  }
}

app.use(express.json({ 
  limit: '10mb',
  type: 'application/json'
}));

// 确保响应使用 UTF-8 编码
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/v1/models', (_req, res) => {
  const response: OpenAIModelsResponse = {
    object: 'list',
    data: [
      { id: 'doubao-fast', object: 'model', created: Date.now(), owned_by: 'doubao' },
      { id: 'doubao-think', object: 'model', created: Date.now(), owned_by: 'doubao' },
      { id: 'doubao-expert', object: 'model', created: Date.now(), owned_by: 'doubao' },
    ],
  };
  res.json(response);
});

app.get('/v1/status', (_req, res) => {
  res.json(pluginStatus);
});

app.post('/v1/chat/completions', async (req, res) => {
  // 使用 Buffer 正确解码中文
  const rawBody = JSON.stringify(req.body);
  logger.info(`收到OpenAI请求: ${rawBody}`);
  
  if (!pluginStatus.connected) {
    logger.error('插件未连接');
    const error: OpenAIError = formatOpenAIError('插件未连接，请确保已安装Chrome插件', 'plugin_disconnected', 503);
    return res.status(503).json(error);
  }
  
  if (!pluginStatus.pageOpened) {
    logger.error('页面未打开');
    const error: OpenAIError = formatOpenAIError('请打开豆包页面后重试', 'page_closed', 503);
    return res.status(503).json(error);
  }
  
  if (!pluginStatus.loggedIn) {
    logger.error('用户未登录');
    const error: OpenAIError = formatOpenAIError('请在豆包页面登录后重试', 'not_logged_in', 503);
    return res.status(503).json(error);
  }
  
  // 检查会话ID
  if (!pluginStatus.conversationId) {
    logger.error('未获取到会话ID');
    const error: OpenAIError = formatOpenAIError('未获取到豆包会话ID，请刷新豆包页面', 'no_conversation_id', 503);
    return res.status(503).json(error);
  }
  
  const chatRequest = req.body as OpenAIChatRequest;
  const requestId = generateRequestId();
  const model = chatRequest.model || 'doubao-fast';
  const needDeepThink = MODEL_MAP[model] || 1;
  
  const messages = truncateMessages(chatRequest.messages);
  const message = buildDoubaoMessage(messages);
  
  logger.info(`处理请求: requestId=${requestId}, model=${model}, conversationId=${pluginStatus.conversationId}, message=${message.substring(0, 100)}`);
  
  if (chatRequest.stream !== false) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    res.write(formatSSE({
      id: `chatcmpl-${requestId}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
    }));
    
    const wsMessage: WSMessage = {
      type: 'chat',
      request_id: requestId,
      conversation_id: pluginStatus.conversationId!,
      bot_id: DOUBAO_BOT_ID,
      need_deep_think: needDeepThink,
      message,
    };
    
    logger.info(`发送WebSocket消息: ${JSON.stringify(wsMessage)}`);
    if (!wsClient) {
      logger.error('WebSocket客户端未连接');
      throw new Error('WebSocket客户端未连接');
    }
    if (wsClient.readyState !== WebSocket.OPEN) {
      logger.error(`WebSocket客户端状态异常: readyState=${wsClient.readyState}`);
      throw new Error('WebSocket客户端未就绪');
    }
    wsClient.send(JSON.stringify(wsMessage));
    logger.info('WebSocket消息发送成功');
    
    const pending = {
      chunks: [] as string[],
      resolve: (text: string) => {
        logger.info(`resolve called: text=${text.substring(0, 50)}`);
        if (text) {
          res.write(formatSSE({
            id: `chatcmpl-${requestId}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
          }));
        }
      },
      reject: (error: Error) => {
        logger.error(`reject called: ${error.message}`);
        res.write(formatSSE({
          id: `chatcmpl-${requestId}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{ index: 0, delta: {}, finish_reason: 'error' }],
          error: { message: error.message },
        } as any));
        res.write('data: [DONE]\n\n');
        res.end();
      },
      controller: new AbortController(),
    };
    
    pendingRequests.set(requestId, pending);
    
    req.on('close', () => {
      logger.info(`请求关闭: requestId=${requestId}`);
      wsClient?.send(JSON.stringify({ type: 'cancel', request_id: requestId }));
      pendingRequests.delete(requestId);
    });
    
    const checkDone = setInterval(() => {
      if (!pendingRequests.has(requestId)) {
        logger.info(`请求完成: requestId=${requestId}`);
        clearInterval(checkDone);
        res.write(formatSSE({
          id: `chatcmpl-${requestId}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        }));
        res.write('data: [DONE]\n\n');
        res.end();
      }
    }, 100);
  } else {
    return new Promise((resolve, reject) => {
      const chunks: string[] = [];
      let errorMsg: string | null = null;
      
      const wsMessage: WSMessage = {
        type: 'chat',
        request_id: requestId,
        conversation_id: pluginStatus.conversationId!,
        bot_id: DOUBAO_BOT_ID,
        need_deep_think: needDeepThink,
        message,
      };
      
      wsClient?.send(JSON.stringify(wsMessage));
      logger.debug(`发送聊天请求: ${requestId}`);
      
      const pending = {
        chunks,
        resolve: (text: string) => {
          if (text) {
            chunks.push(text);
          }
        },
        reject: (error: Error) => {
          errorMsg = error.message;
        },
        controller: new AbortController(),
      };
      
      pendingRequests.set(requestId, pending);
      
      const checkDone = setInterval(() => {
        if (!pendingRequests.has(requestId)) {
          clearInterval(checkDone);
          
          if (errorMsg) {
            const error: OpenAIError = formatOpenAIError(errorMsg, 'doubao_error', 500);
            res.status(500).json(error);
          } else {
            res.json({
              id: `chatcmpl-${requestId}`,
              object: 'chat.completion',
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{
                index: 0,
                message: { role: 'assistant', content: chunks.join('') },
                finish_reason: 'stop',
              }],
              usage: {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
              },
            });
          }
          resolve(undefined);
        }
      }, 100);
      
      req.on('close', () => {
        wsClient?.send(JSON.stringify({ type: 'cancel', request_id: requestId }));
        pendingRequests.delete(requestId);
        reject(new Error('Request cancelled'));
      });
    });
  }
});

export function startServer(port?: number, bind?: string) {
  const config = loadConfig();
  const actualPort = port || config.port;
  const actualBind = bind || config.bind;
  
  server.listen(actualPort, actualBind, () => {
    console.log(`OpenClaw Bridge 已启动`);
    console.log(`代理服务器: http://${actualBind}:${actualPort}`);
    console.log(`WebSocket: ws://${actualBind}:${actualPort}/ws`);
    console.log(`状态: 等待Chrome插件连接...`);
  });
}

export { app, server, wss };