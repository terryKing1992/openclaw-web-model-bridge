let isCrashed = false;

async function checkCrash() {
  try {
    await chrome.runtime.getBackgroundPage();
    return false;
  } catch {
    return true;
  }
}

async function updateStatus() {
  const crashed = await checkCrash();
  
  if (crashed) {
    isCrashed = true;
    document.getElementById('normalView')!.style.display = 'none';
    document.getElementById('crashView')!.style.display = 'block';
    return;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({ type: 'get_status' });
    
    const connectionDot = document.getElementById('connectionDot')!;
    const connectionStatus = document.getElementById('connectionStatus')!;
    const injectDot = document.getElementById('injectDot')!;
    const injectStatus = document.getElementById('injectStatus')!;
    const conversationInput = document.getElementById('conversationId') as HTMLInputElement;
    
    if (response.connected) {
      connectionDot.className = 'status-dot connected';
      connectionStatus.textContent = '已连接';
    } else {
      connectionDot.className = 'status-dot disconnected';
      connectionStatus.textContent = '未连接';
    }
    
    if (response.pageOpened) {
      injectDot.className = 'status-dot connected';
      injectStatus.textContent = '注入成功';
    } else {
      injectDot.className = 'status-dot disconnected';
      injectStatus.textContent = '注入失败';
    }
    
    if (response.conversationId) {
      conversationInput.value = response.conversationId;
    } else {
      conversationInput.value = '';
      conversationInput.placeholder = '请打开豆包聊天页面';
    }
  } catch (error) {
    console.error('获取状态失败:', error);
  }
}

document.getElementById('refreshBtn')?.addEventListener('click', () => {
  updateStatus();
});

document.getElementById('modelSelect')?.addEventListener('change', (e) => {
  const model = (e.target as HTMLSelectElement).value;
  chrome.storage.local.set({ model });
});

document.getElementById('conversationId')?.addEventListener('change', (e) => {
  const conversationId = (e.target as HTMLInputElement).value;
  chrome.runtime.sendMessage({
    type: 'status',
    conversationId,
  });
});

chrome.storage.local.get(['model'], (result: { [key: string]: any }) => {
  if (result.model) {
    const select = document.getElementById('modelSelect') as HTMLSelectElement;
    if (select) {
      select.value = result.model;
    }
  }
});

updateStatus();
setInterval(updateStatus, 5000);