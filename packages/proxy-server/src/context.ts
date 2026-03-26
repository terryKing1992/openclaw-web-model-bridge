import { OpenAIMessage } from './types/openai.js';

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