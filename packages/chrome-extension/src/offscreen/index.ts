let ws: WebSocket | null = null;
let reconnectAttempts = 0;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
let waitingForPong = false;
const MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_INTERVAL = 5000; // 5秒心跳
const HEARTBEAT_TIMEOUT = 3000;  // 3秒超时

interface PluginStatus {
  pageOpened: boolean;
  loggedIn: boolean;
  conversationId: string | null;
  url: string;
}

const pluginStatus: PluginStatus = {
  pageOpened: false,
  loggedIn: false,
  conversationId: null,
  url: '',
};

function connect() {
  if (ws) return;
  
  console.log('[OpenClaw Offscreen] Connecting to WebSocket...');
  ws = new WebSocket('ws://localhost:8765');
  
  ws.onopen = () => {
    console.log('[OpenClaw Offscreen] WebSocket connected');
    reconnectAttempts = 0;
    waitingForPong = false;
    startHeartbeat();
    sendStatus();
  };
  
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      console.log('[OpenClaw Offscreen] Received from proxy:', msg.type, msg);
      handleMessage(msg);
    } catch (e) {
      console.error('[OpenClaw Offscreen] Failed to parse message:', e);
    }
  };
  
  ws.onclose = () => {
    console.log('[OpenClaw Offscreen] WebSocket closed');
    ws = null;
    stopHeartbeat();
    scheduleReconnect();
  };
  
  ws.onerror = (error) => {
    console.error('[OpenClaw Offscreen] WebSocket error:', error);
  };
}

function startHeartbeat() {
  stopHeartbeat();
  
  heartbeatTimer = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      if (waitingForPong) {
        console.log('[OpenClaw Offscreen] Heartbeat timeout, closing connection');
        ws.close();
        return;
      }
      
      waitingForPong = true;
      const pingMsg = { type: 'ping', timestamp: Date.now() };
      console.log('[OpenClaw Offscreen] Sending ping:', pingMsg);
      ws.send(JSON.stringify(pingMsg));
      
      heartbeatTimeout = setTimeout(() => {
        if (waitingForPong && ws) {
          console.log('[OpenClaw Offscreen] No pong received, closing connection');
          ws.close();
        }
      }, HEARTBEAT_TIMEOUT);
    }
  }, HEARTBEAT_INTERVAL);
  
  console.log('[OpenClaw Offscreen] Heartbeat started (interval: 5s)');
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (heartbeatTimeout) {
    clearTimeout(heartbeatTimeout);
    heartbeatTimeout = null;
  }
  waitingForPong = false;
}

function scheduleReconnect() {
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  
  console.log(`[OpenClaw Offscreen] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
  
  setTimeout(() => {
    connect();
  }, delay);
}

function sendStatus() {
  if (ws?.readyState === WebSocket.OPEN) {
    const msg = { type: 'status', ...pluginStatus };
    console.log('[OpenClaw Offscreen] Sending status to proxy:', msg);
    ws.send(JSON.stringify(msg));
  }
}

function handleMessage(msg: any) {
  if (msg.type === 'pong') {
    console.log('[OpenClaw Offscreen] Received pong from proxy:', msg);
    waitingForPong = false;
    if (heartbeatTimeout) {
      clearTimeout(heartbeatTimeout);
      heartbeatTimeout = null;
    }
    return;
  }
  
  // 来自代理服务器的chat/cancel消息，转发到background，再转发到content script
  if (msg.type === 'chat') {
    console.log('[OpenClaw Offscreen] Forwarding chat to content script via background:', msg);
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[OpenClaw Offscreen] Failed to forward chat:', chrome.runtime.lastError);
      } else {
        console.log('[OpenClaw Offscreen] Chat forwarded successfully, response:', response);
      }
    });
  }
  
  if (msg.type === 'cancel') {
    console.log('[OpenClaw Offscreen] Forwarding cancel to content script via background:', msg);
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[OpenClaw Offscreen] Failed to forward cancel:', chrome.runtime.lastError);
      } else {
        console.log('[OpenClaw Offscreen] Cancel forwarded successfully, response:', response);
      }
    });
  }
}

// 从content script接收响应消息，转发到proxy
chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
  console.log('[OpenClaw Offscreen] Received:', message.type, 'from:', sender.tab ? 'content' : 'extension');
  
  if (message.type === 'status') {
    Object.assign(pluginStatus, message);
    sendStatus();
    sendResponse({ received: true });
  } else if (message.type === 'delta' || message.type === 'done' || message.type === 'error') {
    // 来自content script的响应，转发到proxy
    if (ws?.readyState === WebSocket.OPEN) {
      console.log('[OpenClaw Offscreen] Forwarding to proxy:', message.type, message);
      ws.send(JSON.stringify(message));
    } else {
      console.error('[OpenClaw Offscreen] WebSocket not open, cannot forward');
    }
    sendResponse({ received: true });
  } else if (message.type === 'page_closed') {
    pluginStatus.pageOpened = false;
    pluginStatus.loggedIn = false;
    pluginStatus.conversationId = null;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'page_closed' }));
    }
    sendResponse({ received: true });
  } else if (message.type === 'get_status') {
    sendResponse({
      connected: ws?.readyState === WebSocket.OPEN,
      ...pluginStatus,
    });
  } else {
    // 其他消息（如chat的响应），也需要响应
    sendResponse({ received: true });
  }
  return true;
});

connect();