import fs from 'fs';
import path from 'path';
import os from 'os';

const LOG_DIR = path.join(os.homedir(), '.openclaw-bridge', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'bridge.log');
const PID_FILE = path.join(os.homedir(), '.openclaw-bridge', 'bridge.pid');

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function formatLog(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  return `${timestamp} [${level.toUpperCase()}] ${message}\n`;
}

export function log(level: LogLevel, message: string) {
  ensureLogDir();
  const line = formatLog(level, message);
  fs.appendFileSync(LOG_FILE, line);
  
  if (level === 'error') {
    console.error(line.trim());
  } else if (level === 'warn') {
    console.warn(line.trim());
  } else {
    console.log(line.trim());
  }
}

export function info(message: string) {
  log('info', message);
}

export function warn(message: string) {
  log('warn', message);
}

export function error(message: string) {
  log('error', message);
}

export function debug(message: string) {
  log('debug', message);
}

export function writePid(pid: number) {
  ensureLogDir();
  fs.writeFileSync(PID_FILE, String(pid));
}

export function readPid(): number | null {
  try {
    const pid = fs.readFileSync(PID_FILE, 'utf-8');
    return parseInt(pid, 10);
  } catch {
    return null;
  }
}

export function removePid() {
  try {
    fs.unlinkSync(PID_FILE);
  } catch {}
}

export function getLogFile(): string {
  return LOG_FILE;
}

export function getLogFileContent(lines: number = 100): string {
  try {
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const allLines = content.trim().split('\n');
    return allLines.slice(-lines).join('\n');
  } catch {
    return '';
  }
}