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

chrome.runtime.onMessage.addListener((message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  console.log('[OpenClaw Background] Received message:', message.type, 'from:', sender.id || 'extension');
  
  if (message.type === 'get_status') {
    chrome.runtime.sendMessage(message).then((response: any) => {
      sendResponse(response);
    }).catch((e) => {
      console.error('[OpenClaw Background] Failed to send message:', e);
      sendResponse({ connected: false });
    });
    return true;
  }
  
  if (message.type === 'status' || 
      message.type === 'delta' || 
      message.type === 'done' || 
      message.type === 'error' ||
      message.type === 'page_closed') {
    chrome.runtime.sendMessage(message).catch((e) => {
      console.error('[OpenClaw Background] Failed to forward message:', e);
    });
    sendResponse({ received: true });
    return true;
  }
  
  if (message.type === 'chat' || message.type === 'cancel') {
    chrome.runtime.sendMessage(message).catch((e) => {
      console.error('[OpenClaw Background] Failed to forward message:', e);
    });
    sendResponse({ received: true });
    return true;
  }
  
  return false;
});

chrome.tabs.onRemoved.addListener(async (tabId: number) => {
  try {
    await chrome.tabs.get(tabId);
  } catch {
    chrome.runtime.sendMessage({ type: 'page_closed' });
  }
});

console.log('[OpenClaw Background] Service worker loaded');