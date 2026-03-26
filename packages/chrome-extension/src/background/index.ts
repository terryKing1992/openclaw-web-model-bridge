let creating: Promise<void> | null = null;

async function ensureOffscreenDocument() {
  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    });
    
    if (existingContexts.length > 0) {
      console.log('[OpenClaw Background] Offscreen document already exists');
      return;
    }
    
    if (creating) {
      await creating;
      return;
    }
    
    console.log('[OpenClaw Background] Creating offscreen document...');
    creating = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: '保持WebSocket连接不被Service Worker休眠中断',
    });
    
    await creating;
    creating = null;
    console.log('[OpenClaw Background] Offscreen document created');
  } catch (e) {
    console.error('[OpenClaw Background] Failed to create offscreen document:', e);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  ensureOffscreenDocument();
});

chrome.runtime.onStartup.addListener(() => {
  ensureOffscreenDocument();
});

ensureOffscreenDocument();

// 存储当前活动的豆包标签页
let activeDoubaoTabId: number | null = null;

// 监听标签页更新，记录豆包页面
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url?.includes('doubao.com')) {
    activeDoubaoTabId = tabId;
    console.log('[OpenClaw Background] 记录豆包标签页:', tabId);
  }
});

// 监听标签页激活
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url?.includes('doubao.com')) {
    activeDoubaoTabId = activeInfo.tabId;
    console.log('[OpenClaw Background] 激活豆包标签页:', activeInfo.tabId);
  }
});

chrome.runtime.onMessage.addListener((message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  console.log('[OpenClaw Background] Received message:', message.type, 'from:', sender.id ? 'extension' : ('tab' in sender ? 'content' : 'popup'));
  
  // 来自 Popup 的 get_status 请求，转发到 Offscreen
  if (message.type === 'get_status') {
    if (sender.id) {
      // 来自 popup，转发到 offscreen
      chrome.runtime.sendMessage(message).then((response: any) => {
        sendResponse(response);
      }).catch((e) => {
        console.error('[OpenClaw Background] Failed to get status:', e);
        sendResponse({ connected: false });
      });
    }
    return true;
  }
  
  // 来自 Content Script 的状态更新，转发到 Offscreen
  if (message.type === 'status' || 
      message.type === 'delta' || 
      message.type === 'done' || 
      message.type === 'error' ||
      message.type === 'page_closed') {
    if (!sender.id) {
      // 来自 content script，转发到 offscreen
      chrome.runtime.sendMessage(message).catch((e) => {
        console.error('[OpenClaw Background] Failed to forward message:', e);
      });
    }
    sendResponse({ received: true });
    return true;
  }
  
  // 来自 Popup 的 chat 请求，转发到 Content Script
  if (message.type === 'chat' || message.type === 'cancel' || message.type === 'ping') {
    if (sender.id) {
      // 来自 popup，需要转发到 content script
      if (activeDoubaoTabId) {
        chrome.tabs.sendMessage(activeDoubaoTabId, message).then((response) => {
          sendResponse(response);
        }).catch((e) => {
          console.error('[OpenClaw Background] Failed to send to content script:', e);
          sendResponse({ error: e.message });
        });
      } else {
        sendResponse({ error: '请先打开豆包页面' });
      }
      return true;
    } else {
      // 来自 content script 的响应，不需要转发
      sendResponse({ received: true });
      return true;
    }
  }
  
  // 来自 Popup 的 chat_to_doubao 请求，转发到 Content Script
  if (message.type === 'chat_to_doubao') {
    if (activeDoubaoTabId) {
      console.log('[OpenClaw Background] 转发chat_to_doubao到豆包标签页:', activeDoubaoTabId);
      // 转换为chat类型发送到content script
      const chatMessage = {
        type: 'chat',
        request_id: message.request_id,
        conversation_id: message.conversation_id,
        bot_id: message.bot_id,
        need_deep_think: message.need_deep_think,
        message: message.message,
      };
      chrome.tabs.sendMessage(activeDoubaoTabId, chatMessage).then((response) => {
        console.log('[OpenClaw Background] content script响应:', response);
        sendResponse(response);
      }).catch((e) => {
        console.error('[OpenClaw Background] Failed to send to content script:', e);
        sendResponse({ error: e.message });
      });
    } else {
      console.error('[OpenClaw Background] 没有活动的豆包标签页');
      sendResponse({ error: '请先打开豆包页面' });
    }
    return true;
  }
  
  return false;
});

chrome.tabs.onRemoved.addListener(async (tabId: number) => {
  try {
    await chrome.tabs.get(tabId);
  } catch {
    if (tabId === activeDoubaoTabId) {
      activeDoubaoTabId = null;
    }
    chrome.runtime.sendMessage({ type: 'page_closed' });
  }
});

console.log('[OpenClaw Background] Service worker loaded');