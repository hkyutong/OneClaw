# Local Work Progress

## 2026-03-16

- 同步 `openclaw/openclaw` 的 `upstream/main`，更新到 2026-03-16 的主线状态。
- 保留 OneClaw 的仓库身份设置，包括 `oneclaw` 包名、`oneclaw` CLI 入口和 OneClaw README。
- 保留 OneClaw 的产品化定制方向：macOS 安装器、YutoAPI 接入、中文化文案，以及 Linux/WSL 的 Docker 部署路径。

## 2026-03-15

- 调研了 `https://clawhub.ai/` 的公开结构、API 和可抓取范围。
- 确认 ClawHub 不只是网址，也有公开 GitHub 仓库：`https://github.com/openclaw/clawhub`。
- 基于公开接口和抽样数据，估算当前公开 skill 库容量：
  - 仅保存最新版本原始文本文件，约 `1.30 GiB`
  - 仅保存最新版本 zip 包，约 `0.66 GiB`
  - 站点前端静态资源约 `1.1 MiB`
- 建议服务器存储：
  - 仅做公开最新版本镜像：`5 GiB` 起步
  - 预留冗余、备份和后续增长：`10 GiB` 更稳
- 额外确认：
  - `robots.txt` 当前未禁止抓取
  - 当前公开 skill 总数约 `22.2k`
