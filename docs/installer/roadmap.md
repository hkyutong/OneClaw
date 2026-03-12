# OneClaw Installer 路线图

## Phase 0：架构定稿

目标：

- 明确产品边界
- 确认单仓库结构
- 固化安装计划与平台策略

输出：

- `README.md`
- `docs/installer/architecture.md`
- `packages/installer-core`

## Phase 1：安装模型落地

目标：

- 把安装过程抽象成可执行计划
- 让 UI 只消费结构化状态

交付：

- `InstallPlan`
- `InstallStep`
- 错误码与恢复模型
- 平台预检模型

验收标准：

- 输入环境状态，可以稳定输出同一份安装计划
- 安装、修复、升级可以共用状态机

## Phase 2：桌面壳与预检

目标：

- 搭建 `Electron` 桌面端
- 完成预检、阻断和日志展示

交付：

- 欢迎页
- 安全提示
- 平台预检页
- 阻断处理页
- 安装进度与日志展示

验收标准：

- 能稳定完成完整预检并给出阻断 / 注意 / 就绪结论

## Phase 3：macOS Docker 安装主链

目标：

- 打通 `macOS` 的真实图形化安装流程

交付：

- Docker Desktop 检测与一键处理
- OneClaw 工作区准备
- GUI 一键配置
- gateway 启动与健康验证
- 打开图形界面入口

验收标准：

- 一台全新 Mac 可通过 GUI 完成 OneClaw Docker 安装

## Phase 4：Linux 与高级兜底

目标：

- 补齐 Linux Docker 路线
- 增加高级终端兜底和日志导出

交付：

- Linux 环境检测
- Docker Engine / Compose 检测
- 高级终端操作入口
- 重试、修复、日志导出

验收标准：

- Linux 用户可通过 GUI 完成安装或快速定位错误

## Phase 5：Windows + WSL2

目标：

- 打通 Windows 官方推荐路径

交付：

- `WSL2` 检测与引导
- WSL 发行版初始化
- WSL 内 Docker 路线安装
- Windows 侧打开控制台 / 日志入口

验收标准：

- 普通用户可跟随 GUI 在新 Windows 机器上完成安装

## Phase 6：修复、升级、卸载

目标：

- 让项目从“能安装”变成“可维护”

交付：

- 版本检测
- 一键修复
- 通道切换
- 卸载与残留清理

验收标准：

- 用户不需要进入终端也能完成主要维护动作
