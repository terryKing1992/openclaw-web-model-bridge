let ws: WebSocket | null = null;
let reconnectAttempts = 0;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
const MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 5000;

interface PluginStatus {
  pageOpened: boolean;
  loggedIn: boolean;
  conversationId: string | null;
  url: string;
}

const status: PluginStatus = {
  pageOpened: false,
  loggedIn: false,
  conversationId: null,
  url: '',
};

function connect() {
  if (ws) return;
  
  ws = new WebSocket('ws://localhost:8765');
  
  ws.onopen = () => {
    reconnectAttempts = 0;
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
    ws = null;
    stopHeartbeat();
    scheduleReconnect();
  };
  
  ws.onerror = (error) => {
    console.error('[OpenClaw Offscreen] WebSocket error:', error);
  };
}

function startHeartbeat() {
  heartbeatTimer = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'ping',
        timestamp: Date.now(),
      }));
      
      heartbeatTimeout = setTimeout(() => {
        ws?.close();
      }, HEARTBEAT_TIMEOUT);
    }
  }, HEARTBEAT_INTERVAL);
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
}

function scheduleReconnect() {
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  
  setTimeout(() => {
    connect();
  }, delay);
}

function sendStatus() {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'status',
      ...status,
    }));
  }
}

function handleMessage(msg: any) {
  if (msg.type === 'pong') {
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'status') {
    Object.assign(status, message);
    sendStatus();
    sendResponse({ received: true });
  } else if (message.type === 'delta' || message.type === 'done' || message.type === 'error') {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
    sendResponse({ received: true });
  } else if (message.type === 'page_closed') {
    status.pageOpened = false;
    status.loggedIn = false;
    status.conversationId = null;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'page_closed' }));
    }
    sendResponse({ received: true });
  } else if (message.type === 'get_status') {
    sendResponse({
      connected: ws?.readyState === WebSocket.OPEN,
      ...status,
    });
  }
  return true;
});

connect();