# OpenClaw Bridge

通过 Chrome 插件访问豆包网页模型，提供 OpenAI 协议兼容的本地代理服务器。

## 功能特性

- ✅ OpenAI 协议兼容（流式 + 非流式）
- ✅ 支持三种模型模式：快速、思考、专家
- ✅ 会话 ID 自动检测/手动输入
- ✅ 上下文消息拼接与截断
- ✅ 请求取消支持
- ✅ API 错误退避重试
- ✅ 开机自启动（macOS/Windows）
- ✅ 后台运行（daemon 模式）

## 安装

### 1. 安装代理服务器

```bash
# 克隆项目
git clone https://github.com/your-repo/openclaw-web-model-bridge.git
cd openclaw-web-model-bridge

# 安装依赖
npm install

# 构建
npm run build
```

### 2. 安装 Chrome 插件

1. 打开 Chrome，访问 `chrome://extensions/`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `packages/chrome-extension` 目录

### 3. 启动代理服务器

```bash
npm run start
# 或
node packages/proxy-server/dist/cli/index.js start
```

### 4. 打开豆包并登录

访问 https://www.doubao.com 并登录你的账号。

## 使用方法

### API 端点

代理服务器默认运行在 `http://localhost:8765`

#### 获取模型列表

```bash
curl http://localhost:8765/v1/models
```

#### 对话补全（流式）

```bash
curl http://localhost:8765/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-fast",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": true
  }'
```

#### 查看状态

```bash
curl http://localhost:8765/v1/status
```

### CLI 命令

```bash
# 启动服务
openclaw-bridge start

# 指定端口
openclaw-bridge start -p 9000

# 绑定到所有网卡（局域网访问）
openclaw-bridge start --bind 0.0.0.0

# 后台运行
openclaw-bridge start --daemon

# 停止服务
openclaw-bridge stop

# 查看状态
openclaw-bridge status

# 查看日志
openclaw-bridge logs

# 开机自启动
openclaw-bridge autostart enable
```

### 模型选择

| 模型名称 | 说明 |
|---------|------|
| `doubao-fast` | 快速模式（默认） |
| `doubao-think` | 思考模式 |
| `doubao-expert` | 专家模式 |

## 配置

配置文件位于 `~/.openclaw-bridge/config.json`

```json
{
  "port": 8765,
  "bind": "127.0.0.1",
  "timeout": 1800000,
  "maxContextRounds": 5
}
```

## 安全提示

- 默认只绑定 `127.0.0.1`，仅允许本地访问
- 如果绑定到 `0.0.0.0`，其他设备可能访问你的服务
- 请确保在可信网络环境下使用

## 项目结构

```
openclaw-web-model-bridge/
├── packages/
│   ├── proxy-server/      # 本地代理服务器
│   │   └── src/
│   │       ├── server.ts   # HTTP + WebSocket 服务
│   │       ├── cli/        # CLI 命令
│   │       └── types/      # 类型定义
│   │
│   └── chrome-extension/   # Chrome 插件
│       ├── src/
│       │   ├── background/  # Background Script
│       │   ├── content/     # Content Script
│       │   └── popup/       # Popup UI
│       └── manifest.json
│
└── README.md
```

## 常见问题

### 插件显示"未连接"

确保代理服务器已启动，并运行在默认端口 8765。

### 提示"请在豆包页面登录"

打开豆包网页并登录你的账号。

### 请求返回 403

上下文消息可能过长，系统会自动截断。如果仍然失败，请减少消息内容。

## 开发

```bash
# 开发模式
npm run dev

# 构建
npm run build

# 代码检查
npm run lint
```

## License

MIT
