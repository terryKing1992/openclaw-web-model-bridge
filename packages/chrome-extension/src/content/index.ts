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
  
  const patterns = [
    /\/chat\/(\d+)/,
    /\/chat\/(local_[a-zA-Z0-9_]+)/,
    /\/chat\/([a-zA-Z0-9_-]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = pathname.match(pattern);
    if (match && match[1]) {
      console.log('[OpenClaw] 从URL获取会话ID:', match[1]);
      return match[1];
    }
  }
  
  return null;
}

function getConversationIdFromPage(): string | null {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const convId = urlParams.get('conversation_id') || urlParams.get('conv_id');
    if (convId) {
      console.log('[OpenClaw] 从URL参数获取会话ID:', convId);
      return convId;
    }
    
    const storedConvId = localStorage.getItem('doubao_conversation_id') ||
                          localStorage.getItem('current_conversation_id');
    if (storedConvId) {
      console.log('[OpenClaw] 从localStorage获取会话ID:', storedConvId);
      return storedConvId;
    }
    
    const state = (window as any).__DOUBAO_STATE__ || (window as any).__INITIAL_STATE__;
    if (state?.conversationId || state?.conversation_id) {
      const id = state.conversationId || state.conversation_id;
      console.log('[OpenClaw] 从页面状态获取会话ID:', id);
      return id;
    }
  } catch (e) {
    console.error('[OpenClaw] 获取会话ID失败:', e);
  }
  
  return null;
}

function checkLoginStatus(): boolean {
  try {
    const token = localStorage.getItem('token') || 
                  localStorage.getItem('auth_token') ||
                  getCookie('token') ||
                  getCookie('sessionid');
    
    if (token) {
      return true;
    }
    
    const userAvatar = document.querySelector('[class*="avatar"]') || 
                       document.querySelector('[class*="user-info"]') ||
                       document.querySelector('[class*="profile"]') ||
                       document.querySelector('[data-user-id]');
    
    if (userAvatar) {
      return true;
    }
    
    const loginButton = document.querySelector('[class*="login"]');
    return !loginButton;
  } catch (e) {
    console.error('[OpenClaw] 检测登录状态失败:', e);
    return false;
  }
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

function sendStatus() {
  let conversationId = getConversationId() || getConversationIdFromPage() || lastConversationId;
  const loggedIn = checkLoginStatus();
  
  if (!conversationId && loggedIn) {
    conversationId = 'new';
  }
  
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

function setupUrlObserver() {
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log('[OpenClaw] URL changed:', window.location.href);
      sendStatus();
    }
  });
  
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
}

setupUrlObserver();

setInterval(() => {
  sendStatus();
}, 30000);

setTimeout(sendStatus, 1000);
setTimeout(sendStatus, 3000);

console.log('[OpenClaw] Content script loaded');