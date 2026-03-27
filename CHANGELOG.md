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

#### WebSocket 消息转发回调问题

**问题**: 通过 Node Server 调用豆包接口时请求快速关闭，但插件直接调试正常

**原因**: Offscreen 发送消息给 Background 时未正确处理响应回调，导致消息转发失败
- 使用 `.catch()` 处理 Promise 但缺少回调
- Background 期望返回响应但未正确处理

**解决方案**:
1. 使用回调函数 `chrome.runtime.sendMessage(msg, callback)` 替代 Promise
2. 检查 `chrome.runtime.lastError` 错误状态
3. 添加成功/失败响应日志便于调试

#### 豆包 API 请求体格式问题

**问题**: 会话无法正确创建或接续，conversation_id 传递失败

**原因**: 
1. `conversation_id` 被设置为 `request.conversation_id || ''`，空字符串导致无法匹配现有会话
2. `need_create_conversation` 动态判断逻辑不符合实际 API 要求
3. 缺少 `message_status` 等必要字段

**解决方案**:
1. 直接传递 `conversation_id` 原始值，不再默认空字符串
2. 将 `need_create_conversation` 改为固定 `false`
3. 添加 `message_status: 1` 到 messages 数组
4. 添加 `sub_conv_status`、`sub_conv_type`、`source` 等 ext 字段

#### Express 类型推断问题

**问题**: 构建时报错 `TS2883: The inferred type of 'app' cannot be named without a reference to 'Express'`

**原因**: pnpm 的 `.store` 目录结构导致 TypeScript 无法正确推断 express 类型

**解决方案**: 为 `app` 变量添加显式类型注解 `const app: express.Application = express()`

#### Content Script ES Module 问题

**问题**: Content Script 报错 `Cannot use import statement outside a module`

**原因**: TypeScript 编译输出为 ES Module 格式，但 Chrome 扩展的 Content Script 不支持 ES Module

**解决方案**: 
1. 使用 esbuild 打包，输出 IIFE (立即执行函数) 格式
2. 添加 `build.js` 构建脚本
3. 更新 package.json 构建命令

#### WebSocket 心跳机制问题

**问题**: WebSocket 连接没有正确的心跳检测，可能导致连接断开后无法检测

**原因**: 
1. 心跳超时定时器被覆盖，没有正确等待 pong 响应
2. 缺少 `waitingForPong` 状态标志

**解决方案**:
1. 添加 `waitingForPong` 状态标志
2. 发送 ping 前检查是否在等待 pong，如果是则关闭连接
3. 收到 pong 后正确重置状态

#### 登录状态检测问题

**问题**: 登录状态始终返回 false

**原因**: 无法正确匹配豆包页面的登录按钮元素

**解决方案**: 使用 `data-testid="toLogin"` 选择器检测登录按钮，找到即未登录，找不到即已登录

#### 豆包会话 ID 获取问题

**问题**: 无法自动获取豆包的会话 ID

**原因**: 消息字段名不匹配
- Chrome 扩展发送驼峰命名: `loggedIn`, `conversationId`
- 代理服务器期望蛇形命名: `logged_in`, `conversation_id`

**解决方案**:
1. 修改代理服务器支持两种命名格式
2. 添加详细的日志输出便于调试
3. 改进 URL 变化检测，使用定时器轮询

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

#### Popup 调试功能添加

**新增功能**: 在插件 Popup 中添加直接调试豆包 API 的界面

**功能详情**:
1. 添加文本输入框用于输入测试消息
2. 添加发送按钮触发直接 API 调用
3. 添加响应数据显示区域，显示原始响应数据
4. 添加状态提示（加载中/成功/失败）
5. 支持 Enter 键快捷发送

#### Popup 崩溃检测修复

**问题**: Popup 显示"插件已崩溃"

**原因**: 使用了 Manifest V3 不兼容的 API `chrome.runtime.getBackgroundPage()`

**解决方案**: 移除 `getBackgroundPage` 调用，改为通过发送消息检测 Service Worker 是否正常工作