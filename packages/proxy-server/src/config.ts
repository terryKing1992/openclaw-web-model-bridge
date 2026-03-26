export const CONFIG = {
  port: 8765,
  bind: '127.0.0.1',
  timeout: 1800000,
  heartbeatInterval: 30000,
  heartbeatTimeout: 5000,
  reconnectDelay: 1000,
  reconnectMaxDelay: 30000,
  maxContextRounds: 5,
  minContextRounds: 1,
  logLevel: 'info' as const,
};

export type Config = typeof CONFIG;

export function loadConfig(): Config {
  return { ...CONFIG };
}