const DOUBAO_BOT_ID = '7338286299411103781';
const MAX_RETRIES = 2;
const DEBUG = true; // 调试模式

function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log('[OpenClaw Debug]', ...args);
  }
}

interface ChatRequest {
  request_id: string;
  conversation_id: string;
  bot_id: string;
  need_deep_think: number;
  message: string;
}

interface DoubaoParams {
  aid: string;
  device_id: string;
  web_id: string;
  tea_uuid: string;
  fp: string;
  pc_version: string;
}

const abortControllers = new Map<string, AbortController>();

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

function getLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function getDoubaoParams(): DoubaoParams {
  const aid = getCookie('aid') || getLocalStorage('aid') || '497858';
  const device_id = getCookie('device_id') || getLocalStorage('device_id') || getCookie('tt_wid') || '';
  const web_id = getCookie('web_id') || getLocalStorage('web_id') || device_id;
  const tea_uuid = getCookie('tea_uuid') || getLocalStorage('tea_uuid') || web_id;
  const fp = getCookie('fp') || getLocalStorage('fp') || '';
  const pc_version = getCookie('pc_version') || getLocalStorage('pc_version') || '3.11.3';
  
  debugLog('Doubao params:', { aid, device_id, web_id, tea_uuid, fp: fp ? '[set]' : '[empty]', pc_version });
  
  return { aid, device_id, web_id, tea_uuid, fp, pc_version };
}

function generateLocalId(): string {
  return 'local_' + Math.random().toString(36).slice(2, 15);
}

function generateMessageId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : 
    'msg_' + Math.random().toString(36).slice(2, 15);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildRequestBody(request: ChatRequest): any {
  const localMessageId = generateMessageId();
  const localConversationId = generateLocalId();
  
  const body = {
    client_meta: {
      local_conversation_id: localConversationId,
      conversation_id: request.conversation_id || '',
      bot_id: request.bot_id || DOUBAO_BOT_ID,
      last_section_id: '',
      last_message_index: null,
    },
    messages: [{
      local_message_id: localMessageId,
      content_block: [{
        block_type: 10000,
        content: {
          text_block: {
            text: request.message,
            icon_url: '',
            icon_url_dark: '',
            summary: '',
          },
        },
        pc_event_block: '',
      }],
      block_id: crypto.randomUUID ? crypto.randomUUID() : generateMessageId(),
      parent_id: '',
      meta_info: [],
      append_fields: [],
    }],
    option: {
      send_message_scene: '',
      create_time_ms: Date.now(),
      collect_id: '',
      is_audio: false,
      answer_with_suggest: false,
      tts_switch: false,
      need_deep_think: request.need_deep_think,
      click_clear_context: false,
      from_suggest: false,
      is_regen: false,
      is_replace: false,
      disable_sse_cache: false,
      select_text_action: '',
      resend_for_regen: false,
      scene_type: 0,
      unique_key: crypto.randomUUID ? crypto.randomUUID() : generateMessageId(),
      start_seq: 0,
      need_create_conversation: !request.conversation_id,
      conversation_init_option: {
        need_ack_conversation: true,
      },
      regen_query_id: [],
      edit_query_id: [],
      regen_instruction: '',
      no_replace_for_regen: false,
      message_from: 0,
      shared_app_name: '',
      sse_recv_event_options: {
        support_chunk_delta: true,
      },
      is_ai_playground: false,
    },
    ext: {
      conversation_init_option: '{"need_ack_conversation":true}',
      fp: '',
      use_deep_think: String(request.need_deep_think),
      commerce_credit_config_enable: '0',
      sub_conv_firstmet_type: '1',
    },
  };
  
  debugLog('Request body:', JSON.stringify(body, null, 2));
  
  return body;
}

function buildUrl(params: DoubaoParams): string {
  const url = new URL('https://www.doubao.com/chat/completion');
  
  url.searchParams.set('aid', params.aid);
  url.searchParams.set('device_platform', 'web');
  url.searchParams.set('language', 'zh');
  url.searchParams.set('pc_version', params.pc_version);
  url.searchParams.set('samantha_web', '1');
  
  if (params.device_id) {
    url.searchParams.set('device_id', params.device_id);
  }
  if (params.web_id) {
    url.searchParams.set('web_id', params.web_id);
  }
  if (params.tea_uuid) {
    url.searchParams.set('tea_uuid', params.tea_uuid);
  }
  if (params.fp) {
    url.searchParams.set('fp', params.fp);
  }
  
  url.searchParams.set('use-olympus-account', '1');
  url.searchParams.set('region', '');
  url.searchParams.set('sys_region', '');
  
  const urlString = url.toString();
  debugLog('Request URL:', urlString);
  
  return urlString;
}

async function sendDoubaoChatWithRetry(request: ChatRequest, retryCount: number = 0): Promise<void> {
  debugLog('sendDoubaoChat called:', request, 'retry:', retryCount);
  
  const controller = new AbortController();
  abortControllers.set(request.request_id, controller);
  
  const params = getDoubaoParams();
  const url = buildUrl(params);
  const body = buildRequestBody(request);
  
  debugLog('Starting fetch...');
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': window.location.href,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    
    debugLog('Response received:', response.status, response.statusText);
    
    if (!response.ok) {
      debugLog('Response not OK:', response.status);
      if (response.status === 403) {
        window.postMessage({
          __openclaw: true,
          type: 'response',
          data: {
            request_id: request.request_id,
            error: 'CONTEXT_TOO_LONG',
            status: 403,
          },
        }, '*');
        return;
      }
      
      if ((response.status >= 500 || response.status === 429) && retryCount < MAX_RETRIES) {
        const delay = 1000 * Math.pow(2, retryCount);
        debugLog(`Retrying in ${delay}ms...`);
        await sleep(delay);
        return sendDoubaoChatWithRetry(request, retryCount + 1);
      }
      
      const errorText = await response.text();
      debugLog('Error response body:', errorText);
      
      window.postMessage({
        __openclaw: true,
        type: 'response',
        data: {
          request_id: request.request_id,
          error: `HTTP ${response.status}: ${errorText}`,
        },
      }, '*');
      return;
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      debugLog('No reader available');
      window.postMessage({
        __openclaw: true,
        type: 'response',
        data: {
          request_id: request.request_id,
          error: '无法读取响应',
        },
      }, '*');
      return;
    }
    
    debugLog('Starting to read SSE stream...');
    
    const decoder = new TextDecoder();
    let buffer = '';
    let totalChunks = 0;
    let lastEventId = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        debugLog('Stream done');
        break;
      }
      
      buffer += decoder.decode(value, { stream: true });
      debugLog('Raw SSE data chunk:', value);
      debugLog('Buffer after decode:', buffer.substring(0, 200));
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      const chunks: string[] = [];
      let isDone = false;
      let hasChunkDelta = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        debugLog('Processing SSE line:', line);
        
        if (line.startsWith('id:')) {
          lastEventId = line.slice(3).trim();
          debugLog('Event ID:', lastEventId);
        }
        
        if (line.startsWith('event: CHUNK_DELTA')) {
          hasChunkDelta = true;
          const dataLine = lines[i + 1];
          debugLog('Found CHUNK_DELTA, next line:', dataLine);
          
          if (dataLine?.startsWith('data: ')) {
            try {
              const jsonStr = dataLine.slice(6);
              debugLog('Parsing JSON:', jsonStr);
              const data = JSON.parse(jsonStr);
              debugLog('Parsed data:', data);
              
              if (data.text) {
                chunks.push(data.text);
                totalChunks++;
                debugLog('Extracted text:', data.text);
              }
            } catch (e) {
              debugLog('Failed to parse CHUNK_DELTA:', e, 'dataLine:', dataLine);
            }
          }
        } else if (line.startsWith('event: SSE_REPLY_END')) {
          debugLog('Found SSE_REPLY_END');
          isDone = true;
        } else if (line.startsWith('event: SSE_ACK')) {
          debugLog('Found SSE_ACK');
        } else if (line.startsWith('event:')) {
          debugLog('Found other event:', line);
        }
      }
      
      if (chunks.length > 0) {
        debugLog(`Sending ${chunks.length} chunks to content script`);
        window.postMessage({
          __openclaw: true,
          type: 'response',
          data: {
            request_id: request.request_id,
            chunks,
          },
        }, '*');
      }
      
      if (isDone) {
        debugLog('Stream complete, total chunks:', totalChunks);
        window.postMessage({
          __openclaw: true,
          type: 'response',
          data: {
            request_id: request.request_id,
            done: true,
          },
        }, '*');
      }
    }
    
    debugLog('Finished reading stream, total chunks sent:', totalChunks);
    
  } catch (error: any) {
    debugLog('Error during fetch:', error);
    
    if (error.name === 'AbortError') {
      debugLog('Request aborted');
      return;
    }
    
    if (retryCount < MAX_RETRIES) {
      const delay = 1000 * Math.pow(2, retryCount);
      debugLog(`Error, retrying in ${delay}ms...`, error.message);
      await sleep(delay);
      return sendDoubaoChatWithRetry(request, retryCount + 1);
    }
    
    window.postMessage({
      __openclaw: true,
      type: 'response',
      data: {
        request_id: request.request_id,
        error: error.message,
      },
    }, '*');
  } finally {
    abortControllers.delete(request.request_id);
  }
}

async function sendDoubaoChat(request: ChatRequest): Promise<void> {
  return sendDoubaoChatWithRetry(request, 0);
}

// 全局调试函数
(window as any).testDoubaoRequest = async (message: string) => {
  debugLog('Manual test triggered');
  const testRequest: ChatRequest = {
    request_id: 'test_' + Date.now(),
    conversation_id: '',
    bot_id: DOUBAO_BOT_ID,
    need_deep_think: 1,
    message: message,
  };
  
  await sendDoubaoChat(testRequest);
};

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  
  const msg = event.data;
  if (!msg.__openclaw) return;
  
  debugLog('Received message from content script:', msg.type);
  
  if (msg.type === 'chat_request') {
    debugLog('Starting chat request:', msg.data);
    sendDoubaoChat(msg.data);
  } else if (msg.type === 'cancel_request') {
    debugLog('Cancelling request:', msg.data.request_id);
    const controller = abortControllers.get(msg.data.request_id);
    if (controller) {
      controller.abort();
      abortControllers.delete(msg.data.request_id);
    }
  }
});

console.log('[OpenClaw Inject] Script loaded. Debug mode:', DEBUG);
console.log('[OpenClaw Inject] Test function available: window.testDoubaoRequest("your message")');

window.postMessage({
  __openclaw: true,
  type: 'injected',
}, '*');