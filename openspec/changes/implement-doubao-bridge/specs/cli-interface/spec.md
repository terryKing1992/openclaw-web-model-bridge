## ADDED Requirements

### Requirement: 启动命令
CLI SHALL提供启动代理服务器的命令。

#### Scenario: 前台启动
- **WHEN** 用户执行 `openclaw-bridge start`
- **THEN** 代理服务器在前台运行
- **AND** 输出日志到控制台

#### Scenario: 后台启动
- **WHEN** 用户执行 `openclaw-bridge start --daemon`
- **THEN** 代理服务器在后台运行
- **AND** 输出PID

#### Scenario: 指定端口
- **WHEN** 用户执行 `openclaw-bridge start -p 9000`
- **THEN** 代理服务器在端口9000启动

#### Scenario: 指定绑定地址
- **WHEN** 用户执行 `openclaw-bridge start --bind 0.0.0.0`
- **THEN** 代理服务器绑定到指定地址
- **AND** 显示安全警告

### Requirement: 停止命令
CLI SHALL提供停止代理服务器的命令。

#### Scenario: 停止服务
- **WHEN** 用户执行 `openclaw-bridge stop`
- **THEN** 代理服务器停止运行

#### Scenario: 重启服务
- **WHEN** 用户执行 `openclaw-bridge restart`
- **THEN** 代理服务器重启

### Requirement: 状态命令
CLI SHALL提供查询服务状态的命令。

#### Scenario: 查询状态
- **WHEN** 用户执行 `openclaw-bridge status`
- **THEN** 输出服务状态、插件连接状态、会话ID、模型等

### Requirement: 日志命令
CLI SHALL提供查看日志的命令。

#### Scenario: 查看日志
- **WHEN** 用户执行 `openclaw-bridge logs`
- **THEN** 输出最近的日志

#### Scenario: 实时日志
- **WHEN** 用户执行 `openclaw-bridge logs --follow`
- **THEN** 实时输出日志

### Requirement: 配置命令
CLI SHALL提供编辑配置的命令。

#### Scenario: 编辑配置
- **WHEN** 用户执行 `openclaw-bridge config`
- **THEN** 打开配置文件进行编辑

### Requirement: 版本命令
CLI SHALL提供查看版本的命令。

#### Scenario: 查看版本
- **WHEN** 用户执行 `openclaw-bridge version`
- **THEN** 输出当前版本号