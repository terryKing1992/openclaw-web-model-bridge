## ADDED Requirements

### Requirement: 请求格式转换
豆包适配器SHALL将OpenAI格式转换为豆包API格式。

#### Scenario: 消息转换
- **WHEN** 收到OpenAI格式的messages数组
- **THEN** 转换为豆包格式的请求体
- **AND** 包含 `client_meta`、`messages`、`option` 字段

#### Scenario: 会话信息填充
- **WHEN** 构造豆包请求
- **THEN** 填充 `conversation_id`、`bot_id`、`need_deep_think` 等字段

### Requirement: 响应解析
豆包适配器SHALL解析豆包SSE响应并提取文本内容。

#### Scenario: 忽略非文本事件
- **WHEN** 收到 `SSE_HEARTBEAT`、`SSE_ACK`、`FULL_MSG_NOTIFY` 等事件
- **THEN** 忽略这些事件

#### Scenario: 解析CHUNK_DELTA
- **WHEN** 收到 `event: CHUNK_DELTA` 且 `data: {"text":"<content>"}`
- **THEN** 提取文本内容
- **AND** 转换为OpenAI delta格式

#### Scenario: 检测响应结束
- **WHEN** 收到 `event: SSE_REPLY_END`
- **THEN** 标记响应完成

### Requirement: 页面注入请求
豆包适配器SHALL在页面context中发起请求。

#### Scenario: 发起请求
- **WHEN** 收到聊天请求
- **THEN** 在页面context中构造并发送fetch请求
- **AND** 自动携带Cookie
- **AND** 自动生成a_bogus签名

#### Scenario: 请求取消
- **WHEN** 收到取消请求
- **THEN** 中止当前fetch请求

### Requirement: 错误处理
豆包适配器SHALL处理豆包API错误。

#### Scenario: 403错误
- **WHEN** 豆包返回403
- **THEN** 通知代理服务器上下文太长

#### Scenario: 网络错误
- **WHEN** 请求失败
- **THEN** 返回错误信息给代理服务器

### Requirement: 重试机制
豆包适配器SHALL支持请求重试。

#### Scenario: 自动重试
- **WHEN** 收到5xx、429或超时错误
- **THEN** 等待后重试
- **AND** 最多重试2次

#### Scenario: 重试退避
- **WHEN** 执行重试
- **THEN** 第1次等待1秒，第2次等待2秒