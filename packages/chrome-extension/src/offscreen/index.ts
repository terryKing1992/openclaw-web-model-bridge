let ws: WebSocket | null = null;
let reconnectAttempts = 0;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
let waitingForPong = false;
const MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 5000;

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
      ws.send(JSON.stringify({
        type: 'ping',
        timestamp: Date.now(),
      }));
      
      heartbeatTimeout = setTimeout(() => {
        if (waitingForPong && ws) {
          console.log('[OpenClaw Offscreen] No pong received, closing connection');
          ws.close();
        }
      }, HEARTBEAT_TIMEOUT);
    }
  }, HEARTBEAT_INTERVAL);
  
  console.log('[OpenClaw Offscreen] Heartbeat started (interval: 30s)');
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
    ws.send(JSON.stringify({
      type: 'status',
      ...pluginStatus,
    }));
  }
}

function handleMessage(msg: any) {
  if (msg.type === 'pong') {
    waitingForPong = false;
    if (heartbeatTimeout) {
      clearTimeout(heartbeatTimeout);
      heartbeatTimeout = null;
    }
    return;
  }
  
  if (msg.type === 'chat') {
    chrome.runtime.sendMessage(msg);
  }
  
  if (msg.type === 'cancel') {
    chrome.runtime.sendMessage(msg);
  }
}

chrome.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
  if (message.type === 'status') {
    Object.assign(pluginStatus, message);
    sendStatus();
    sendResponse({ received: true });
  } else if (message.type === 'delta' || message.type === 'done' || message.type === 'error') {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
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
  }
  return true;
});

connect();