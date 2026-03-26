## Why

用户希望通过本地代理服务器访问豆包网页模型能力，使得任何支持OpenAI协议的客户端（如cursor、continue等）都能直接调用豆包模型，无需等待官方API开放或支付API费用。

## What Changes

- 新增本地代理服务器，提供OpenAI协议兼容的API端点
- 新增Chrome插件，通过注入页面context访问豆包网页模型
- 支持流式和非流式响应
- 支持三种模型模式：快速、思考、专家
- 支持会话ID自动检测和手动输入
- 支持上下文消息拼接与截断
- 支持请求取消
- 支持API错误退避重试
- 支持开机自启动（macOS/Windows）
- 支持后台运行（daemon模式）
- 支持安全绑定地址配置

## Capabilities

### New Capabilities

- `proxy-server`: 本地代理服务器，提供OpenAI协议兼容的HTTP API和WebSocket服务端
- `chrome-extension`: Chrome插件，注入豆包页面并转发请求
- `openai-protocol`: OpenAI协议兼容层，支持流式和非流式响应
- `doubao-adapter`: 豆包API适配器，处理请求格式转换和响应解析
- `context-management`: 上下文管理，处理消息拼接、截断和LRU策略
- `cli-interface`: 命令行界面，提供启动、停止、状态查询等命令
- `autostart`: 开机自启动功能，支持macOS和Windows
- `connection-management`: 连接管理，包括心跳、重连、状态检测

### Modified Capabilities

无

## Impact

- 新项目，无现有代码影响
- 用户需要安装Node.js环境和Chrome浏览器
- 用户需要登录豆包网页版获取模型访问权限
- 代理服务器默认监听localhost:8765，可选绑定到其他网卡