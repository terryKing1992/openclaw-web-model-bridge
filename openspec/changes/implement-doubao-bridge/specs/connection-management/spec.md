## ADDED Requirements

### Requirement: WebSocket连接
插件SHALL通过WebSocket连接代理服务器。

#### Scenario: 连接成功
- **WHEN** 插件连接到 `ws://localhost:8765/ws`
- **THEN** 发送注册消息 `{"type": "register", "client": "doubao-plugin"}`
- **AND** 等待代理服务器确认

#### Scenario: 连接失败
- **WHEN** 连接失败
- **THEN** 显示"未连接"状态
- **AND** 启动重连机制

### Requirement: 心跳机制
连接管理器SHALL维持WebSocket连接活跃。

#### Scenario: 发送心跳
- **WHEN** 连接建立后
- **THEN** 每30秒发送 `{"type": "ping", "timestamp": <time>}`

#### Scenario: 收到心跳响应
- **WHEN** 收到 `{"type": "pong", "timestamp": <time>}`
- **THEN** 重置超时计数器

#### Scenario: 心跳超时
- **WHEN** 发送ping后5秒未收到pong
- **THEN** 标记连接异常
- **AND** 连续3次超时后触发重连

### Requirement: 自动重连
连接管理器SHALL支持自动重连。

#### Scenario: 连接断开
- **WHEN** WebSocket连接断开
- **THEN** 启动指数退避重连
- **AND** 初始延迟1秒，最大延迟30秒

#### Scenario: 重连成功
- **WHEN** 重连成功
- **THEN** 重置退避延迟
- **AND** 发送状态更新

### Requirement: 状态通知
连接管理器SHALL及时通知状态变化。

#### Scenario: 状态变化
- **WHEN** 任何状态变化（连接、断开、登录、会话等）
- **THEN** 发送WebSocket消息通知代理服务器

#### Scenario: 完整状态
- **WHEN** 发送状态通知
- **THEN** 包含 `logged_in`、`conversation_id`、`url` 等字段