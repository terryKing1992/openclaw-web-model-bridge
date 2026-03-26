# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-03-26

### 新增

- 实现 OpenAI 协议兼容的本地代理服务器
  - 支持 `/v1/models` 和 `/v1/chat/completions` 端点
  - 支持流式和非流式响应
  - WebSocket 服务端，等待 Chrome 插件连接

- 实现 Chrome 插件
  - Manifest V3 配置
  - Content Script 注入豆包页面
  - Offscreen Document 保持 WebSocket 连接
  - Popup UI 显示连接状态

- 实现豆包 API 适配器
  - SSE 响应解析，提取 CHUNK_DELTA 文本
  - 模型名称映射 (doubao-fast/think/expert)
  - 错误重试机制（指数退避，最多2次）
  - 动态获取 aid、device_id 等参数（从 Cookie/localStorage）

- 实现上下文管理
  - 消息拼接功能
  - 上下文截断（默认5轮）
  - LRU 逐步减少逻辑
  - 403 错误检测和处理

- 实现完整 CLI 命令
  - start/stop/restart/status
  - logs/config/autostart

- 实现开机自启动
  - macOS launchd 配置生成

### 修复

#### WebSocket 心跳机制问题

**问题**: WebSocket 连接没有正确的心跳检测，可能导致连接断开后无法检测

**原因**: 
1. 心跳超时定时器被覆盖，没有正确等待 pong 响应
2. 缺少 `waitingForPong` 状态标志

**解决方案**:
1. 添加 `waitingForPong` 状态标志
2. 发送 ping 前检查是否在等待 pong，如果是则关闭连接
3. 收到 pong 后正确重置状态

#### 豆包会话 ID 获取问题

**问题**: 无法自动获取豆包的会话 ID

**原因**: 
1. URL 匹配正则只支持纯数字格式，不支持 `local_xxx` 格式
2. 没有从 SSE_ACK 响应中提取 conversation_id

**解决方案**:
1. 扩展 URL 匹配正则，支持多种会话 ID 格式
2. 在 inject.ts 中解析 SSE_ACK 事件，提取 conversation_id
3. 从 URL 参数、localStorage、页面状态等多个来源获取会话 ID

#### Chrome 扩展图标文件缺失

**问题**: 安装 Chrome 扩展时报错 `Could not load icon 'icons/icon16.png' specified in 'icons'`

**原因**: manifest.json 引用了图标文件，但项目中缺少这些文件

**解决方案**: 创建图标文件 icons/icon16.png, icons/icon48.png, icons/icon128.png

#### minimatch 安全漏洞

**问题**: minimatch 9.0.0 - 9.0.6 存在 6 个高危安全漏洞

**原因**: 依赖包 `@typescript-eslint/typescript-estree` 使用了有漏洞的 minimatch 版本

**解决方案**: 在 `package.json` 中添加 `overrides` 强制所有 minimatch 使用安全版本
```json
"overrides": {
  "minimatch": "^9.0.9"
}
```

**结果**: 漏洞数量从 6 high 降为 0

#### TypeScript 编译错误

**问题**: Chrome 插件编译时报错 `Cannot find name 'chrome'`

**原因**: 缺少 Chrome 扩展 API 的 TypeScript 类型定义

**解决方案**:
1. 安装 `@types/chrome` 依赖
2. 在 `tsconfig.json` 中添加 `"types": ["chrome"]`

#### 变量名冲突

**问题**: offscreen/index.ts 中 `status` 变量与全局 `window.status` 冲突

**原因**: TypeScript 的 `lib.dom.d.ts` 声明了全局 `status` 变量

**解决方案**: 将变量重命名为 `pluginStatus`

#### 类型错误

**问题**: 多处参数隐式 `any` 类型和 `unknown` 类型错误

**解决方案**:
1. 为回调函数参数添加显式类型注解
2. 使用类型断言 `as { ... }` 处理 `JSON.parse` 返回的 `unknown` 类型

#### npm 安装超时

**问题**: 在国内网络环境下 npm install 超时

**解决方案**: 配置淘宝镜像源
```bash
npm config set registry https://registry.npMMirror.com
```

### 优化

- 豆包 API 参数动态获取：aid、device_id、web_id、tea_uuid、fp、pc_version 等参数从页面 Cookie/localStorage 动态读取，不再硬编码