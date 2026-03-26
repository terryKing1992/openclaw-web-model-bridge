import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { loadConfig } from './config.js';
import { PluginStatus, WSMessage, MODEL_MAP, DOUBAO_BOT_ID } from './types/ws.js';
import { OpenAIChatRequest, OpenAIModelsResponse, OpenAIError } from './types/openai.js';
import { generateRequestId, formatSSE, formatOpenAIError } from './utils.js';
import { truncateMessages, buildDoubaoMessage } from './context.js';
import * as logger from './logger.js';

const app = express();
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
      const msg: WSMessage = JSON.parse(data.toString());
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
  if (msg.type === 'status') {
    pluginStatus.pageOpened = true;
    pluginStatus.loggedIn = msg.logged_in ?? false;
    pluginStatus.conversationId = msg.conversation_id ?? null;
  } else if (msg.type === 'delta' && msg.request_id && msg.text) {
    const pending = pendingRequests.get(msg.request_id);
    if (pending) {
      pending.chunks.push(msg.text);
      if (pending.resolve) {
        pending.resolve(msg.text);
      }
    }
  } else if (msg.type === 'done' && msg.request_id) {
    const pending = pendingRequests.get(msg.request_id);
    if (pending) {
      pending.resolve('');
      pendingRequests.delete(msg.request_id);
    }
  } else if (msg.type === 'error' && msg.request_id) {
    const pending = pendingRequests.get(msg.request_id);
    if (pending) {
      pending.reject(new Error(msg.message || 'Unknown error'));
      pendingRequests.delete(msg.request_id);
    }
  } else if (msg.type === 'page_closed') {
    pluginStatus.pageOpened = false;
    pluginStatus.loggedIn = false;
    pluginStatus.conversationId = null;
  }
}

app.use(express.json());

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
  if (!pluginStatus.connected) {
    const error: OpenAIError = formatOpenAIError('插件未连接，请确保已安装Chrome插件', 'plugin_disconnected', 503);
    return res.status(503).json(error);
  }
  
  if (!pluginStatus.pageOpened) {
    const error: OpenAIError = formatOpenAIError('请打开豆包页面后重试', 'page_closed', 503);
    return res.status(503).json(error);
  }
  
  if (!pluginStatus.loggedIn) {
    const error: OpenAIError = formatOpenAIError('请在豆包页面登录后重试', 'not_logged_in', 503);
    return res.status(503).json(error);
  }
  
  const chatRequest = req.body as OpenAIChatRequest;
  const requestId = generateRequestId();
  const model = chatRequest.model || 'doubao-fast';
  const needDeepThink = MODEL_MAP[model] || 1;
  
  const messages = truncateMessages(chatRequest.messages);
  const message = buildDoubaoMessage(messages);
  
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
    
    wsClient?.send(JSON.stringify(wsMessage));
    
    const pending = {
      chunks: [] as string[],
      resolve: (text: string) => {
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
      wsClient?.send(JSON.stringify({ type: 'cancel', request_id: requestId }));
      pendingRequests.delete(requestId);
    });
    
    const checkDone = setInterval(() => {
      if (!pendingRequests.has(requestId)) {
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