import { randomUUID } from 'crypto';
import { OpenAIError } from './types/openai.js';

export function generateRequestId(): string {
  return `req_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export function formatSSE(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export function formatOpenAIError(message: string, type: string, code: number): OpenAIError {
  return {
    error: {
      message,
      type,
      code: String(code),
    },
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries) {
        const delay = initialDelay * Math.pow(2, i);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}