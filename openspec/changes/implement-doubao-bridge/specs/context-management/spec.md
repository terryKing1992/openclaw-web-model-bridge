## ADDED Requirements

### Requirement: 消息拼接
上下文管理器SHALL将多条消息拼接为豆包格式。

#### Scenario: 单条消息
- **WHEN** messages数组只有1条消息
- **THEN** 直接使用该消息内容

#### Scenario: 多条消息
- **WHEN** messages数组有多条消息
- **THEN** 拼接为格式化的对话历史
- **AND** 格式为"用户: <content>\n助手: <content>..."

### Requirement: 上下文截断
上下文管理器SHALL默认保留最近5轮对话。

#### Scenario: 超过5轮
- **WHEN** messages数组超过5轮对话（10条消息）
- **THEN** 只保留最近5轮
- **AND** 丢弃最老的对话

#### Scenario: 未超过5轮
- **WHEN** messages数组未超过5轮
- **THEN** 保留所有消息

### Requirement: LRU逐步减少
上下文管理器SHALL在403时逐步减少上下文轮数。

#### Scenario: 首次403
- **WHEN** 豆包返回403（上下文太长）
- **THEN** 减少到4轮并重试

#### Scenario: 持续403
- **WHEN** 重试后仍返回403
- **THEN** 继续减少轮数（3轮、2轮、1轮）

#### Scenario: 最小轮数
- **WHEN** 减少到1轮仍返回403
- **THEN** 返回错误"消息内容过长，请缩短后重试"

### Requirement: 配置项
上下文管理器SHALL支持配置最大轮数。

#### Scenario: 自定义最大轮数
- **WHEN** 用户配置 `max_context_rounds: 10`
- **THEN** 默认保留10轮对话