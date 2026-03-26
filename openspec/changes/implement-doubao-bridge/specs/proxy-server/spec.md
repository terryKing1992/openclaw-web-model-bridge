## ADDED Requirements

### Requirement: 代理服务器启动
代理服务器SHALL支持通过CLI命令启动，默认监听localhost:8765端口。

#### Scenario: 默认启动
- **WHEN** 用户执行 `openclaw-bridge start`
- **THEN** 代理服务器在localhost:8765启动
- **AND** 输出启动成功信息

#### Scenario: 指定端口启动
- **WHEN** 用户执行 `openclaw-bridge start -p 9000`
- **THEN** 代理服务器在localhost:9000启动

#### Scenario: 指定绑定地址
- **WHEN** 用户执行 `openclaw-bridge start --bind 0.0.0.0`
- **THEN** 代理服务器绑定到所有网卡
- **AND** 显示安全警告提示

### Requirement: HTTP API端点
代理服务器SHALL提供OpenAI协议兼容的HTTP API端点。

#### Scenario: 获取模型列表
- **WHEN** 客户端请求 `GET /v1/models`
- **THEN** 返回可用模型列表（doubao-fast、doubao-think、doubao-expert）

#### Scenario: 对话补全
- **WHEN** 客户端请求 `POST /v1/chat/completions`
- **THEN** 代理服务器转发请求到插件
- **AND** 返回OpenAI格式的响应

#### Scenario: 状态查询
- **WHEN** 客户端请求 `GET /v1/status`
- **THEN** 返回当前服务状态（连接状态、登录状态、会话ID、模型）

### Requirement: WebSocket服务端
代理服务器SHALL提供WebSocket服务端，等待Chrome插件连接。

#### Scenario: 插件连接
- **WHEN** Chrome插件连接到 `ws://localhost:8765/ws`
- **THEN** 代理服务器接受连接
- **AND** 更新连接状态为已连接

#### Scenario: 接收消息
- **WHEN** 插件发送WebSocket消息
- **THEN** 代理服务器解析消息类型
- **AND** 根据类型处理（状态更新、响应流、错误等）

### Requirement: 后台运行
代理服务器SHALL支持daemon模式后台运行。

#### Scenario: 后台启动
- **WHEN** 用户执行 `openclaw-bridge start --daemon`
- **THEN** 代理服务器在后台运行
- **AND** 输出PID文件路径

#### Scenario: 停止后台服务
- **WHEN** 用户执行 `openclaw-bridge stop`
- **THEN** 代理服务器停止运行
- **AND** 删除PID文件

### Requirement: 错误处理
代理服务器SHALL返回清晰的错误信息。

#### Scenario: 插件未连接
- **WHEN** 客户端发送请求但插件未连接
- **THEN** 返回HTTP 503错误
- **AND** 错误信息为"插件未连接"

#### Scenario: 用户未登录
- **WHEN** 客户端发送请求但用户未登录豆包
- **THEN** 返回HTTP 503错误
- **AND** 错误信息为"请在豆包页面登录后重试"

#### Scenario: 页面已关闭
- **WHEN** 客户端发送请求但豆包页面已关闭
- **THEN** 返回HTTP 503错误
- **AND** 错误信息为"请打开豆包页面后重试"