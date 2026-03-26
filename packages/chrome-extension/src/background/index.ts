let creating: Promise<void> | null = null;

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  
  if (existingContexts.length > 0) {
    return;
  }
  
  if (creating) {
    await creating;
    return;
  }
  
  creating = chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.WORKERS],
    justification: '保持WebSocket连接不被Service Worker休眠中断',
  });
  
  await creating;
  creating = null;
}

chrome.runtime.onInstalled.addListener(() => {
  ensureOffscreenDocument();
});

chrome.runtime.onStartup.addListener(() => {
  ensureOffscreenDocument();
});

ensureOffscreenDocument();

chrome.runtime.onMessage.addListener((message: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  if (message.type === 'get_status' || 
      message.type === 'status' || 
      message.type === 'delta' || 
      message.type === 'done' || 
      message.type === 'error' ||
      message.type === 'page_closed') {
    chrome.runtime.sendMessage(message).then((response: any) => {
      sendResponse(response);
    });
    return true;
  }
  
  if (message.type === 'chat' || message.type === 'cancel') {
    chrome.runtime.sendMessage(message);
    sendResponse({ received: true });
  }
  
  return true;
});

chrome.tabs.onRemoved.addListener(async (tabId: number) => {
  try {
    await chrome.tabs.get(tabId);
  } catch {
    chrome.runtime.sendMessage({ type: 'page_closed' });
  }
});