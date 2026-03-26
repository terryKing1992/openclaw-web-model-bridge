## ADDED Requirements

### Requirement: 流式响应格式
代理服务器SHALL返回符合OpenAI协议的流式SSE响应。

#### Scenario: 流式请求
- **WHEN** 客户端请求 `POST /v1/chat/completions` 且 `stream: true`
- **THEN** 返回 `Content-Type: text/event-stream`
- **AND** 返回格式符合OpenAI流式响应规范

#### Scenario: 流式首帧
- **WHEN** 流式响应开始
- **THEN** 首帧包含 `delta: { role: "assistant" }`

#### Scenario: 流式文本增量
- **WHEN** 收到豆包的 `CHUNK_DELTA` 事件
- **THEN** 转换为 `data: {"choices":[{"delta":{"content":"<text>"}}]}`

#### Scenario: 流式结束
- **WHEN** 收到豆包的 `SSE_REPLY_END` 事件
- **THEN** 发送 `data: {"choices":[{"delta":{},"finish_reason":"stop"}]}`
- **AND** 发送 `data: [DONE]`

### Requirement: 非流式响应格式
代理服务器SHALL返回符合OpenAI协议的非流式JSON响应。

#### Scenario: 非流式请求
- **WHEN** 客户端请求 `POST /v1/chat/completions` 且 `stream: false`
- **THEN** 返回 `Content-Type: application/json`
- **AND** 返回完整响应

#### Scenario: 非流式响应内容
- **WHEN** 非流式响应完成
- **THEN** 响应包含 `id`、`object`、`created`、`model`、`choices`、`usage` 字段

### Requirement: 模型名称映射
代理服务器SHALL将OpenAI模型名称映射到豆包模式。

#### Scenario: 快速模式
- **WHEN** 客户端请求 `model: "doubao"` 或 `model: "doubao-fast"`
- **THEN** 使用 `need_deep_think: 1`

#### Scenario: 思考模式
- **WHEN** 客户端请求 `model: "doubao-think"`
- **THEN** 使用 `need_deep_think: 2`

#### Scenario: 专家模式
- **WHEN** 客户端请求 `model: "doubao-expert"`
- **THEN** 使用 `need_deep_think: 3`

### Requirement: 请求ID生成
代理服务器SHALL为每个请求生成唯一ID。

#### Scenario: 生成请求ID
- **WHEN** 收到OpenAI请求
- **THEN** 生成唯一的 `request_id`
- **AND** 在WebSocket消息中携带该ID

### Requirement: 错误响应格式
代理服务器SHALL返回OpenAI兼容的错误格式。

#### Scenario: 错误响应
- **WHEN** 发生错误
- **THEN** 返回 `{"error": {"message": "<描述>", "type": "<类型>", "code": "<状态码>"}}`