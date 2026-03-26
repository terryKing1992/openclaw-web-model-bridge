## 1. 项目初始化

- [x] 1.1 创建monorepo项目结构
- [x] 1.2 配置TypeScript和ESLint
- [x] 1.3 配置构建脚本和package.json

## 2. 代理服务器基础

- [x] 2.1 实现HTTP服务器基础框架
- [x] 2.2 实现WebSocket服务端
- [x] 2.3 实现配置管理（读取config.json）
- [x] 2.4 实现日志系统

## 3. OpenAI协议实现

- [x] 3.1 实现 GET /v1/models 端点
- [x] 3.2 实现 POST /v1/chat/completions 端点（流式）
- [x] 3.3 实现 POST /v1/chat/completions 端点（非流式）
- [x] 3.4 实现 GET /v1/status 端点
- [x] 3.5 实现请求ID生成
- [x] 3.6 实现错误响应格式

## 4. WebSocket协议

- [x] 4.1 定义WebSocket消息协议（chat、delta、done、error、status等）
- [x] 4.2 实现消息解析和路由
- [x] 4.3 实现请求-响应匹配（基于request_id）
- [x] 4.4 实现请求取消处理

## 5. 上下文管理

- [x] 5.1 实现消息拼接功能
- [x] 5.2 实现上下文截断（默认5轮）
- [x] 5.3 实现LRU逐步减少逻辑
- [x] 5.4 实现403错误检测和处理

## 6. Chrome插件基础

- [x] 6.1 创建Manifest V3配置
- [x] 6.2 创建插件目录结构
- [x] 6.3 实现Background Script
- [x] 6.4 实现Offscreen Document（保持WebSocket连接）

## 7. Content Script实现

- [x] 7.1 实现Content Script注入逻辑
- [x] 7.2 实现script注入到页面context
- [x] 7.3 实现与注入script的postMessage通信
- [x] 7.4 实现页面卸载检测

## 8. 豆包API适配

- [x] 8.1 分析豆包请求格式并定义类型
- [x] 8.2 实现OpenAI到豆包请求格式转换
- [x] 8.3 实现豆包SSE响应解析（提取CHUNK_DELTA）
- [x] 8.4 实现模型名称映射（doubao-fast/think/expert → need_deep_think）
- [x] 8.5 实现错误重试机制（指数退避，最多2次）

## 9. 插件UI实现

- [x] 9.1 实现Popup HTML/CSS
- [x] 9.2 实现连接状态显示（已连接/未连接）
- [x] 9.3 实现注入状态显示（成功/失败，红色/绿色）
- [x] 9.4 实现崩溃状态显示（裂开图标）
- [x] 9.5 实现会话ID显示和手动输入
- [x] 9.6 实现模型选择下拉框

## 10. 连接管理

- [x] 10.1 实现WebSocket客户端
- [x] 10.2 实现心跳机制（30秒间隔，5秒超时）
- [x] 10.3 实现自动重连（指数退避）
- [x] 10.4 实现状态通知推送

## 11. 状态检测

- [x] 11.1 实现URL会话ID检测
- [x] 11.2 实现登录状态检测
- [x] 11.3 实现页面关闭检测

## 12. CLI命令实现

- [x] 12.1 实现 start 命令（支持--port, --bind, --daemon参数）
- [x] 12.2 实现 stop 命令
- [x] 12.3 实现 restart 命令
- [x] 12.4 实现 status 命令
- [x] 12.5 实现 logs 命令（支持--follow参数）
- [x] 12.6 实现 config 命令
- [x] 12.7 实现 version 命令

## 13. 开机自启动

- [x] 13.1 实现macOS launchd配置生成
- [ ] 13.2 实现Windows注册表配置
- [x] 13.3 实现 autostart enable/disable/status 命令
- [x] 13.4 实现跨平台检测

## 14. 安全性

- [x] 14.1 实现bind参数验证
- [x] 14.2 实现非本地绑定警告提示
- [x] 14.3 添加安全提示文档

## 15. 测试与文档

- [ ] 15.1 编写代理服务器单元测试
- [ ] 15.2 编写端到端测试
- [x] 15.3 编写README文档（中文）
- [ ] 15.4 编写安装指南
- [ ] 15.5 编写使用示例

## 16. 打包与发布

- [ ] 16.1 配置代理服务器npm发布
- [ ] 16.2 配置Chrome插件打包
- [ ] 16.3 编写发布脚本