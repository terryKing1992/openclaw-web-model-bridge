import { DoubaoClient } from './doubao.js';

let doubaoClient: DoubaoClient | null = null;
let currentRequestId: string | null = null;
let lastConversationId: string | null = null;

function injectScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('dist/inject.js');
  script.id = 'openclaw-inject';
  document.documentElement.appendChild(script);
  script.onload = () => script.remove();
}

injectScript();

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  
  const msg = event.data;
  if (!msg.__openclaw) return;
  
  if (msg.type === 'injected') {
    console.log('[OpenClaw] 注入成功');
    doubaoClient = new DoubaoClient();
    sendStatus();
  }
  
  if (msg.type === 'response') {
    const response = msg.data;
    
    if (response.conversation_id && response.conversation_id !== lastConversationId) {
      lastConversationId = response.conversation_id;
      console.log('[OpenClaw] 检测到新会话ID:', response.conversation_id);
      sendStatus();
    }
    
    if (response.chunks) {
      for (const chunk of response.chunks) {
        chrome.runtime.sendMessage({
          type: 'delta',
          request_id: response.request_id,
          text: chunk,
        });
      }
    }
    if (response.done) {
      chrome.runtime.sendMessage({
        type: 'done',
        request_id: response.request_id,
      });
    }
    if (response.error) {
      chrome.runtime.sendMessage({
        type: 'error',
        request_id: response.request_id,
        message: response.error,
      });
    }
  }
});

function getConversationId(): string | null {
  const pathname = window.location.pathname;
  console.log('[OpenClaw] 当前路径:', pathname);
  
  const match = pathname.match(/\/chat\/(\d+)/);
  if (match && match[1]) {
    console.log('[OpenClaw] 从URL获取会话ID:', match[1]);
    return match[1];
  }
  
  return null;
}

function sendStatus() {
  const conversationId = getConversationId() || lastConversationId;
  const loggedIn = !!conversationId;
  
  console.log('[OpenClaw] 发送状态:', {
    pageOpened: true,
    loggedIn,
    conversationId,
    url: window.location.href,
  });
  
  chrome.runtime.sendMessage({
    type: 'status',
    pageOpened: true,
    loggedIn,
    conversationId,
    url: window.location.href,
  });
}

chrome.runtime.onMessage.addListener((message: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  if (message.type === 'chat') {
    currentRequestId = message.request_id;
    sendChatMessage(message);
    sendResponse({ received: true });
  } else if (message.type === 'cancel') {
    if (currentRequestId) {
      cancelRequest(currentRequestId);
    }
    sendResponse({ received: true });
  }
  return true;
});

function sendChatMessage(msg: any) {
  window.postMessage({
    __openclaw: true,
    type: 'chat_request',
    data: {
      request_id: msg.request_id,
      conversation_id: msg.conversation_id,
      bot_id: msg.bot_id,
      need_deep_think: msg.need_deep_think,
      message: msg.message,
    },
  }, '*');
}

function cancelRequest(requestId: string) {
  window.postMessage({
    __openclaw: true,
    type: 'cancel_request',
    data: { request_id: requestId },
  }, '*');
}

window.addEventListener('beforeunload', () => {
  chrome.runtime.sendMessage({ type: 'page_closed' });
});

let lastUrl = window.location.href;

function checkUrlChange() {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    console.log('[OpenClaw] URL changed:', window.location.href);
    sendStatus();
  }
}

setInterval(checkUrlChange, 1000);

window.addEventListener('popstate', () => {
  console.log('[OpenClaw] popstate event');
  checkUrlChange();
});

window.addEventListener('hashchange', () => {
  console.log('[OpenClaw] hashchange event');
  checkUrlChange();
});

setInterval(sendStatus, 30000);

setTimeout(sendStatus, 1000);
setTimeout(sendStatus, 3000);
setTimeout(sendStatus, 5000);

console.log('[OpenClaw] Content script loaded, URL:', window.location.href);