## ADDED Requirements

### Requirement: macOS自启动
系统SHALL支持在macOS上开机自启动。

#### Scenario: 启用自启动
- **WHEN** 用户执行 `openclaw-bridge autostart enable`
- **THEN** 创建launchd plist文件
- **AND** 输出"自启动已启用"

#### Scenario: 禁用自启动
- **WHEN** 用户执行 `openclaw-bridge autostart disable`
- **THEN** 删除launchd plist文件
- **AND** 输出"自启动已禁用"

#### Scenario: 查询状态
- **WHEN** 用户执行 `openclaw-bridge autostart status`
- **THEN** 输出自启动是否启用

### Requirement: Windows自启动
系统SHALL支持在Windows上开机自启动。

#### Scenario: 启用自启动
- **WHEN** 用户执行 `openclaw-bridge autostart enable`
- **THEN** 添加注册表启动项
- **AND** 输出"自启动已启用"

#### Scenario: 禁用自启动
- **WHEN** 用户执行 `openclaw-bridge autostart disable`
- **THEN** 删除注册表启动项
- **AND** 输出"自启动已禁用"

#### Scenario: 查询状态
- **WHEN** 用户执行 `openclaw-bridge autostart status`
- **THEN** 输出自启动是否启用

### Requirement: 跨平台检测
系统SHALL自动检测当前平台并使用对应实现。

#### Scenario: macOS平台
- **WHEN** 在macOS上执行自启动命令
- **THEN** 使用launchd实现

#### Scenario: Windows平台
- **WHEN** 在Windows上执行自启动命令
- **THEN** 使用注册表实现

#### Scenario: 不支持的平台
- **WHEN** 在Linux或其他平台执行自启动命令
- **THEN** 输出"当前平台不支持自启动"