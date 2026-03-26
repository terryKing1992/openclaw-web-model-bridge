export interface WSMessage {
  type: 'register' | 'ping' | 'pong' | 'status' | 'chat' | 'delta' | 'done' | 'error' | 'cancel' | 'page_closed';
  request_id?: string;
  client?: string;
  timestamp?: number;
  logged_in?: boolean;
  conversation_id?: string | null;
  url?: string;
  text?: string;
  message?: string;
  model?: string;
  need_deep_think?: number;
  bot_id?: string;
}

export interface PluginStatus {
  connected: boolean;
  pageOpened: boolean;
  loggedIn: boolean;
  conversationId: string | null;
  model: string;
}

export const DOUBAO_BOT_ID = '7338286299411103781';

export const MODEL_MAP: Record<string, number> = {
  'doubao': 1,
  'doubao-fast': 1,
  'doubao-think': 2,
  'doubao-expert': 3,
};