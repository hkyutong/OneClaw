# OneClaw

OneClaw 是一个面向个人设备与自托管场景的多通道 AI 网关与助理运行时。

这个仓库基于 [OpenClaw](https://github.com/openclaw/openclaw) 进行本地化与品牌化改造，目标是：

- 默认面向中文用户
- 品牌统一为 `OneClaw`
- 保留与上游 `OpenClaw` 的兼容能力
- 保留原始开源许可证

## 许可证

本仓库继续保留上游项目的 [MIT License](LICENSE)。

## 当前状态

- CLI 主命令：`oneclaw`
- 兼容命令：`openclaw`
- Docker 安装入口：`./docker-setup.sh`
- 默认推荐：使用 Docker 完成本地部署

## 快速开始

### 1. 克隆仓库

```bash
git clone git@github.com:hkyutong/OneClaw.git
cd OneClaw
```

### 2. 准备依赖

- macOS / Windows / Linux
- Docker Desktop 或可用的 Docker Engine + Docker Compose
- Node.js 22.12 及以上（如果你要本地开发 CLI）

### 3. Docker 安装

```bash
./docker-setup.sh
```

脚本会完成这些事情：

1. 准备配置目录与工作区
2. 构建或拉取 Docker 运行镜像
3. 启动 OneClaw 的初始化向导
4. 启动 Docker Gateway 服务

## 推荐模型 API

默认推荐在初始化向导里优先选择 `YutoAPI`。

- 统一接入 OpenAI、Claude、Gemini、GLM、Qwen、DeepSeek、Kimi、MiniMax 等主流模型
- 初始化向导里已把 `YutoAPI API key` 放在首位
- 官网与购买入口：<https://gptapi.asia>

如果你已经有 `YUTOAPI_API_KEY`，也可以先写进环境变量，再运行：

```bash
pnpm oneclaw onboard
```

## 与上游兼容说明

为了尽量减少破坏性改动，当前版本仍保留一部分上游兼容路径，例如：

- 兼容 `openclaw` 命令
- 某些内部配置和状态目录仍沿用上游约定
- Docker 运行时与上游核心能力保持兼容

这意味着：

- 现有 OpenClaw 用户迁移成本更低
- ClawGUI 可以直接接入本仓库的 Docker 安装流
- 后续可以继续逐步推进更深层的品牌替换

## 配合 ClawGUI

如果你使用 `ClawGUI` 图形化安装器：

- 安装器会下载本仓库源码包
- 安装器会调用本仓库的 `docker-setup.sh`
- 安装器会生成 OneClaw 的图形化设置与验证入口

## 开发

安装依赖：

```bash
pnpm install
```

构建：

```bash
pnpm build
```

本地运行：

```bash
pnpm oneclaw onboard --install-daemon
```

如果你仍需要兼容上游命令：

```bash
pnpm openclaw onboard --install-daemon
```

## 仓库说明

这个仓库当前优先完成三件事：

- OneClaw 品牌入口统一
- 中文安装与上手体验
- 与 ClawGUI 图形安装器稳定对接
