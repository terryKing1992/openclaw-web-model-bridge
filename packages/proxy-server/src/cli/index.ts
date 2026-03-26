import { Command } from 'commander';
import { spawn } from 'child_process';
import process from 'process';
import { startServer } from '../server.js';
import { loadConfig } from '../config.js';
import * as logger from '../logger.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const program = new Command();

const PID_FILE = path.join(os.homedir(), '.openclaw-bridge', 'bridge.pid');

program
  .name('openclaw-bridge')
  .description('通过Chrome插件访问豆包网页模型的本地代理服务器')
  .version('1.0.0');

program
  .command('start')
  .description('启动代理服务器')
  .option('-p, --port <port>', '端口号', parseInt)
  .option('-b, --bind <address>', '绑定地址')
  .option('-d, --daemon', '后台运行')
  .action((options) => {
    const config = loadConfig();
    const port = options.port || config.port;
    const bind = options.bind || config.bind;
    
    if (bind !== '127.0.0.1' && bind !== 'localhost') {
      console.log('\n⚠️  警告: 你已将服务绑定到非本地地址');
      console.log('⚠️  其他设备可能访问此服务，请确保网络环境安全');
      console.log(`⚠️  当前绑定: ${bind}:${port}\n`);
    }
    
    if (options.daemon) {
      const pid = spawn(process.argv[0], [process.argv[1], 'start', '-p', String(port), '-b', bind], {
        detached: true,
        stdio: 'ignore',
      });
      pid.unref();
      logger.writePid(pid.pid!);
      console.log(`OpenClaw Bridge 已在后台启动 (PID: ${pid.pid})`);
      process.exit(0);
    }
    
    logger.writePid(process.pid);
    startServer(port, bind);
  });

program
  .command('stop')
  .description('停止代理服务器')
  .action(() => {
    try {
      const pid = fs.readFileSync(PID_FILE, 'utf-8');
      process.kill(parseInt(pid, 10), 'SIGTERM');
      logger.removePid();
      console.log('OpenClaw Bridge 已停止');
    } catch {
      console.log('OpenClaw Bridge 未运行或PID文件不存在');
    }
  });

program
  .command('restart')
  .description('重启代理服务器')
  .option('-p, --port <port>', '端口号', parseInt)
  .option('-b, --bind <address>', '绑定地址')
  .action(async (options) => {
    try {
      const pid = fs.readFileSync(PID_FILE, 'utf-8');
      process.kill(parseInt(pid, 10), 'SIGTERM');
      logger.removePid();
      console.log('正在停止 OpenClaw Bridge...');
      await new Promise(r => setTimeout(r, 1000));
    } catch {}
    
    const config = loadConfig();
    const port = options.port || config.port;
    const bind = options.bind || config.bind;
    
    startServer(port, bind);
  });

program
  .command('status')
  .description('查看服务状态')
  .action(async () => {
    try {
      const config = loadConfig();
      const response = await fetch(`http://127.0.0.1:${config.port}/v1/status`);
      const status = await response.json();
      
      console.log('\nOpenClaw Bridge 状态\n');
      console.log(`服务状态: ● 运行中`);
      console.log(`端口: ${config.port}`);
      console.log(`插件状态: ${status.connected ? '● 已连接' : '○ 未连接'}`);
      console.log(`登录状态: ${status.loggedIn ? '已登录' : '未登录'}`);
      console.log(`会话ID: ${status.conversationId || '-'}`);
      console.log(`当前模型: ${status.model || '-'}`);
    } catch {
      console.log('\nOpenClaw Bridge 状态\n');
      console.log('服务状态: ○ 未运行');
    }
  });

program
  .command('logs')
  .description('查看日志')
  .option('-f, --follow', '实时查看')
  .option('-n, --lines <number>', '显示行数', parseInt, 50)
  .action((options) => {
    const logFile = logger.getLogFile();
    
    if (options.follow) {
      console.log('实时日志 (Ctrl+C 退出):');
      const tail = spawn('tail', ['-f', logFile], { stdio: 'inherit' });
      process.on('SIGINT', () => {
        tail.kill();
        process.exit(0);
      });
    } else {
      const content = logger.getLogFileContent(options.lines);
      console.log(content || '日志文件为空');
    }
  });

program
  .command('config')
  .description('编辑配置')
  .option('-p, --port <port>', '端口号', parseInt)
  .option('-b, --bind <address>', '绑定地址')
  .action((options) => {
    const configDir = path.join(os.homedir(), '.openclaw-bridge');
    const configFile = path.join(configDir, 'config.json');
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    let config: any = loadConfig();
    
    if (options.port) config.port = options.port;
    if (options.bind) config.bind = options.bind;
    
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    console.log('配置已保存到:', configFile);
    console.log(JSON.stringify(config, null, 2));
  });

program
  .command('autostart')
  .description('开机自启动管理')
  .argument('<action>', 'enable/disable/status')
  .action((action) => {
    if (action === 'enable') {
      enableAutostart();
    } else if (action === 'disable') {
      disableAutostart();
    } else if (action === 'status') {
      checkAutostart();
    } else {
      console.log('未知操作，请使用 enable/disable/status');
    }
  });

function enableAutostart() {
  const platform = os.platform();
  
  if (platform === 'darwin') {
    const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.openclaw.bridge.plist');
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.openclaw.bridge</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.argv[0]}</string>
    <string>${process.argv[1]}</string>
    <string>start</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>`;
    fs.writeFileSync(plistPath, plist);
    console.log('已启用开机自启动:', plistPath);
  } else if (platform === 'win32') {
    console.log('Windows自启动需要手动添加到启动文件夹');
    console.log('启动文件夹:', path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'));
  } else {
    console.log('当前平台暂不支持开机自启动');
  }
}

function disableAutostart() {
  const platform = os.platform();
  
  if (platform === 'darwin') {
    const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.openclaw.bridge.plist');
    try {
      fs.unlinkSync(plistPath);
      console.log('已禁用开机自启动');
    } catch {
      console.log('自启动未启用');
    }
  } else {
    console.log('当前平台暂不支持');
  }
}

function checkAutostart() {
  const platform = os.platform();
  
  if (platform === 'darwin') {
    const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.openclaw.bridge.plist');
    console.log('开机自启动:', fs.existsSync(plistPath) ? '已启用' : '未启用');
  } else {
    console.log('当前平台暂不支持检测');
  }
}

program.parse();