import { DoubaoClient } from './doubao.js';

let doubaoClient: DoubaoClient | null = null;
let currentRequestId: string | null = null;

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
  const match = window.location.pathname.match(/\/chat\/(\d+)/);
  return match ? match[1] : null;
}

function checkLoginStatus(): boolean {
  const userAvatar = document.querySelector('[class*="avatar"]') || 
                     document.querySelector('[class*="user"]') ||
                     document.querySelector('[data-testid="user-menu"]');
  return !!userAvatar;
}

function sendStatus() {
  const conversationId = getConversationId();
  const loggedIn = checkLoginStatus();
  
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
new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    sendStatus();
  }
}).observe(document.body, { childList: true, subtree: true });

setInterval(sendStatus, 30000);