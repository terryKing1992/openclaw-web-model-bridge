import { OpenAIMessage } from './types/openai.js';

const MAX_MESSAGE_LENGTH = 32000; // 32K 字符限制

export function truncateMessages(messages: OpenAIMessage[], maxRounds: number = 5): OpenAIMessage[] {
  const totalRounds = Math.floor(messages.length / 2);
  
  if (totalRounds <= maxRounds) {
    return messages;
  }
  
  const keepMessages = maxRounds * 2;
  return messages.slice(-keepMessages);
}

export function buildDoubaoMessage(messages: OpenAIMessage[]): string {
  const lines: string[] = [];
  
  for (const msg of messages) {
    const role = msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : '系统';
    lines.push(`${role}: ${msg.content}`);
  }
  
  return lines.join('\n');
}

export function lruReduce(messages: OpenAIMessage[], currentRounds: number): OpenAIMessage[] {
  const newRounds = Math.max(1, currentRounds - 1);
  return truncateMessages(messages, newRounds);
}

// 限制消息长度在 32K 字符内，删除最前面的消息
export function limitMessageLength(messages: OpenAIMessage[], maxLength: number = MAX_MESSAGE_LENGTH): OpenAIMessage[] {
  // 先检查总长度
  let totalLength = 0;
  for (const msg of messages) {
    totalLength += (msg.content?.length || 0);
  }
  
  if (totalLength <= maxLength) {
    return messages;
  }
  
  // 需要截断，保留系统消息和最后几条消息
  const result: OpenAIMessage[] = [];
  let currentLength = 0;
  
  // 先添加系统消息（通常在开头）
  const systemMessages = messages.filter(m => m.role === 'system');
  for (const msg of systemMessages) {
    result.push(msg);
    currentLength += (msg.content?.length || 0);
  }
  
  // 从后往前添加消息，直到达到限制
  const nonSystemMessages = messages.filter(m => m.role !== 'system');
  const reversed = [...nonSystemMessages].reverse();
  const tempResult: OpenAIMessage[] = [];
  
  for (const msg of reversed) {
    const msgLength = msg.content?.length || 0;
    if (currentLength + msgLength > maxLength) {
      break;
    }
    tempResult.push(msg);
    currentLength += msgLength;
  }
  
  // 合并结果（系统消息 + 倒序后的消息再反转）
  return [...result, ...tempResult.reverse()];
}

// 截断一半长度用于重试
export function halveMessages(messages: OpenAIMessage[]): OpenAIMessage[] {
  // 保留系统消息
  const systemMessages = messages.filter(m => m.role === 'system');
  const nonSystemMessages = messages.filter(m => m.role !== 'system');
  
  // 截断一半
  const halfCount = Math.floor(nonSystemMessages.length / 2);
  const kept = nonSystemMessages.slice(-halfCount);
  
  return [...systemMessages, ...kept];
}