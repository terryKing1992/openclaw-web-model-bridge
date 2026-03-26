## ADDED Requirements

### Requirement: 插件初始化
Chrome插件SHALL在安装后自动初始化并尝试连接代理服务器。

#### Scenario: 首次安装
- **WHEN** 用户安装Chrome插件
- **THEN** 插件自动连接 `ws://localhost:8765/ws`
- **AND** 显示连接状态

#### Scenario: 代理服务器未启动
- **WHEN** 插件尝试连接但代理服务器未启动
- **THEN** 插件显示"未连接"状态
- **AND** 提供重连按钮

### Requirement: Content Script注入
插件SHALL在豆包页面加载时自动注入Content Script。

#### Scenario: 访问豆包页面
- **WHEN** 用户访问 `https://www.doubao.com/*`
- **THEN** Content Script自动注入
- **AND** 注入script到页面context

#### Scenario: 注入状态显示
- **WHEN** Content Script注入成功
- **THEN** 插件Popup显示绿色"注入成功"状态

#### Scenario: 注入失败
- **WHEN** Content Script注入失败
- **THEN** 插件Popup显示红色"注入失败"状态
- **AND** 提供刷新重试按钮

### Requirement: 会话ID检测
插件SHALL自动从URL检测会话ID。

#### Scenario: 自动检测会话ID
- **WHEN** 用户访问 `https://www.doubao.com/chat/38418627860848642`
- **THEN** 插件自动提取会话ID为 `38418627860848642`
- **AND** 通知代理服务器

#### Scenario: 手动输入会话ID
- **WHEN** 用户在插件Popup输入会话ID
- **THEN** 插件更新当前会话ID
- **AND** 通知代理服务器

### Requirement: 登录状态检测
插件SHALL检测用户在豆包页面的登录状态。

#### Scenario: 已登录
- **WHEN** 用户在豆包页面已登录
- **THEN** 插件检测到登录状态
- **AND** 通知代理服务器 `logged_in: true`

#### Scenario: 未登录
- **WHEN** 用户在豆包页面未登录
- **THEN** 插件检测到未登录状态
- **AND** 通知代理服务器 `logged_in: false`

### Requirement: 模型选择
插件SHALL提供模型模式选择下拉框。

#### Scenario: 选择模型
- **WHEN** 用户在插件Popup选择模型模式
- **THEN** 插件保存选择
- **AND** 后续请求使用选择的模型

#### Scenario: 默认模型
- **WHEN** 用户未选择模型
- **THEN** 默认使用 `doubao-fast`（快速模式）

### Requirement: 插件状态UI
插件Popup SHALL显示完整的连接和注入状态。

#### Scenario: 正常状态
- **WHEN** 插件连接成功且注入成功
- **THEN** 显示绿色连接状态
- **AND** 显示绿色注入状态
- **AND** 显示当前会话ID和模型

#### Scenario: 崩溃状态
- **WHEN** 插件崩溃
- **THEN** 显示裂开图标
- **AND** 提示用户重启浏览器或重新安装插件

### Requirement: 页面关闭检测
插件SHALL检测豆包页面关闭事件。

#### Scenario: 页面关闭
- **WHEN** 用户关闭豆包页面
- **THEN** 插件检测到页面关闭
- **AND** 通知代理服务器 `page_opened: false`