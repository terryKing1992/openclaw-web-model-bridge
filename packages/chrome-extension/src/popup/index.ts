let isCrashed = false;

async function updateStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'get_status' });
    
    if (isCrashed) {
      isCrashed = false;
      document.getElementById('normalView')!.style.display = 'block';
      document.getElementById('crashView')!.style.display = 'none';
    }
    
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
    isCrashed = true;
    document.getElementById('normalView')!.style.display = 'none';
    document.getElementById('crashView')!.style.display = 'block';
  }
}

async function sendDebugRequest() {
  const input = document.getElementById('debugInput') as HTMLTextAreaElement;
  const output = document.getElementById('debugOutput')!;
  const status = document.getElementById('debugStatus')!;
  const sendBtn = document.getElementById('debugSendBtn') as HTMLButtonElement;
  
  const message = input.value.trim();
  if (!message) {
    status.textContent = '请输入消息内容';
    status.className = 'debug-status error show';
    return;
  }
  
  sendBtn.disabled = true;
  status.textContent = '检查豆包页面...';
  status.className = 'debug-status loading show';
  output.className = 'debug-output';
  output.textContent = '等待响应...\n';
  
  try {
    const requestId = 'debug_' + Date.now();
    
    console.log('[OpenClaw Popup] 发送chat请求到background:', { requestId, message });
    
    // 通过background发送消息到豆包标签页
    const response = await chrome.runtime.sendMessage({
      type: 'chat_to_doubao',
      request_id: requestId,
      conversation_id: '',
      bot_id: '7338286299411103781',
      need_deep_think: 1,
      message: message,
    });
    
    console.log('[OpenClaw Popup] 收到background响应:', response);
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    status.textContent = '发送中...';
    
    let fullText = '';
    let isComplete = false;
    
const listener = (msg: any) => {
      if (msg.request_id !== requestId) return;
      
      const timestamp = Date.now();
      console.log(`[Popup] ${timestamp} 收到消息: type=${msg.type}, chunk_id=${msg.chunk_id || 'N/A'}, text="${msg.text?.substring(0, 50) || ''}"`);
      
      if (msg.type === 'delta') {
        fullText += msg.text;
        console.log(`[Popup] 累积文本: "${fullText}"`);
        output.textContent = `Request ID: ${requestId}\n\n响应内容:\n${fullText}\n\n原始数据:\n${JSON.stringify(msg, null, 2)}\n\n--- 持续接收中 ---`;
      } else if (msg.type === 'done') {
        isComplete = true;
        status.textContent = '请求完成';
        status.className = 'debug-status success show';
        output.textContent = `Request ID: ${requestId}\n\n完整响应:\n${fullText}\n\n--- 完成 ---`;
        chrome.runtime.onMessage.removeListener(listener);
        sendBtn.disabled = false;
      } else if (msg.type === 'error') {
        isComplete = true;
        status.textContent = '请求失败: ' + msg.message;
        status.className = 'debug-status error show';
        output.textContent = `错误: ${msg.message}\n\n原始数据:\n${JSON.stringify(msg, null, 2)}`;
        chrome.runtime.onMessage.removeListener(listener);
        sendBtn.disabled = false;
      }
    };
    
    chrome.runtime.onMessage.addListener(listener);
    
    setTimeout(() => {
      if (!isComplete) {
        chrome.runtime.onMessage.removeListener(listener);
        status.textContent = '请求超时';
        status.className = 'debug-status error show';
        output.textContent = `Request ID: ${requestId}\n\n已接收内容:\n${fullText}\n\n--- 超时 ---`;
        sendBtn.disabled = false;
      }
    }, 30000);
    
  } catch (error: any) {
    console.error('[OpenClaw Popup] 错误:', error);
    status.textContent = '发送失败: ' + error.message;
    status.className = 'debug-status error show';
    output.textContent = `错误详情:\n${error.message}\n\n请确保:\n1. 已打开豆包页面\n2. 页面已完全加载\n3. 插件已启用\n\n如果问题持续，请刷新豆包页面。`;
    sendBtn.disabled = false;
  }
}

function clearDebugOutput() {
  const output = document.getElementById('debugOutput')!;
  const status = document.getElementById('debugStatus')!;
  output.className = 'debug-output empty';
  output.textContent = '等待发送请求...';
  status.className = 'debug-status';
  status.textContent = '';
}

document.getElementById('refreshBtn')?.addEventListener('click', updateStatus);

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

document.getElementById('debugSendBtn')?.addEventListener('click', sendDebugRequest);
document.getElementById('debugClearBtn')?.addEventListener('click', clearDebugOutput);

document.getElementById('debugInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendDebugRequest();
  }
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