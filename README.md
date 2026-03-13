# OneClaw

OneClaw 是一个自托管的多通道网关和运行时。

## 用安装向导安装（macOS）

如果你使用 macOS，可以直接使用图形安装向导。

1. 在 [GitHub Releases](https://github.com/hkyutong/OneClaw/releases) 下载并解压 macOS 安装包
2. 双击 `启动 OneClaw Installer.command`
3. 如果 macOS 阻止打开，到 `系统设置 -> 隐私与安全性` 里点 `仍要打开`
4. 按向导安装 Docker Desktop
5. 在向导里选择 API 提供商，填写 API Key 和模型 ID
6. 完成后在安装器里打开 OneClaw 图形界面，或运行 Doctor 检查状态

说明：

- 安装器会准备 OneClaw 的 Docker 工作区
- 安装器会生成设置脚本和验证脚本
- 如果你已经有 Docker 环境，安装器会直接复用

## 从源码部署

### 1. 克隆仓库

```bash
git clone git@github.com:hkyutong/OneClaw.git
cd OneClaw
```

### 2. 准备依赖

- Docker Desktop，或可用的 Docker Engine + Docker Compose
- Node.js 22.12 及以上

### 3. 运行 Docker 安装脚本

```bash
./docker-setup.sh
```

这个脚本会：

1. 准备配置目录和工作区
2. 构建或拉取 Docker 镜像
3. 启动初始化流程
4. 启动 Gateway

## Windows

Windows 当前按 `WSL2 + Ubuntu + Docker Desktop` 路线部署，不建议直接在 Windows 原生环境里运行。

### 1. 安装 WSL2 和 Ubuntu

以管理员身份打开 PowerShell：

```powershell
wsl --install -d Ubuntu
wsl --update
wsl -l -v
```

执行完成后重启 Windows，再首次打开 Ubuntu，按提示创建 Linux 用户名和密码。

### 2. 安装 Docker Desktop

- 安装并启动 Docker Desktop
- 确认启用 `WSL 2` 后端
- 在 `Settings -> Resources -> WSL Integration` 中勾选 Ubuntu

### 3. 在 Ubuntu 里部署

```bash
sudo apt update
sudo apt install -y git
git clone https://github.com/hkyutong/OneClaw.git
cd OneClaw
chmod +x docker-setup.sh
./docker-setup.sh
```

建议把仓库放在 Ubuntu 的 Linux 文件系统里，例如 `~/OneClaw`，不要放在 `/mnt/c/...` 这种挂载路径里。

### 4. 常用命令

```bash
docker compose ps
docker compose logs -f oneclaw-gateway
docker compose run --rm oneclaw-cli doctor
docker compose run --rm oneclaw-cli dashboard --no-open
```

## API 提供商说明

初始化时可以选择 `YutoAPI`、`OpenAI` 或 `Claude`。

如果使用 `YutoAPI`：

- 使用 YutoAPI 提供的 key
- 安装器和向导默认接入 `https://gptapi.asia/v1`
- 这是兼容 OpenAI 的接口格式，不代表要填写 OpenAI 官方 key

如果在 WSL / Docker 环境里遇到网络问题，可以先测试：

```bash
curl -I https://gptapi.asia/v1/models
```

如果返回 `401` 或提示未提供令牌，通常说明网络是通的，只是没有带 key。

## 命令

- 主命令：`oneclaw`
- 兼容命令：`openclaw`

常用安装器命令：

```bash
pnpm installer:build
pnpm installer:dev
pnpm installer:dev:web
pnpm installer:package:macos
```

常用开发命令：

```bash
pnpm install
pnpm build
pnpm oneclaw onboard --install-daemon
```

如果需要兼容旧命令：

```bash
pnpm openclaw onboard --install-daemon
```

## 许可证

本仓库保留上游项目的 [MIT License](LICENSE)。
