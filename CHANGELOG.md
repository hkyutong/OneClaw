# Local Work Progress

## 2026-03-19

- 重新评估 OneClaw 的内容与分发策略，对标了 OpenAI 的 `robots.txt` / `sitemap.xml`、Google Search Central 的 people-first 内容原则，以及 Stripe / Vercel 的 `llms.txt` 做法。
- 为 OneClaw 补 AI SEO 入口，新增了面向 LLM 抓取的 `docs/llms.txt`，并补了一页 OneClaw 专用说明页。
- 在文档首页增加 OneClaw 入口，明确 OneClaw 与 OpenClaw 的关系、平台支持和推荐起步路径。
- 新增 `docs/compare/oneclaw-vs-openclaw.md`，把 OneClaw 与 OpenClaw 的关系、平台支持差异和推荐使用场景说清楚。
- 在 `docs/help/faq.md` 增加 OneClaw 高频问题回答，包括 “OneClaw 是什么”、“和 OpenClaw 的区别” 以及 “是否支持 Linux”。
- 更新 `docs/docs.json`，补了 OneClaw 相关导航入口和重定向路径，增强 AI 与搜索入口的一致性。
- 新增 `docs/why-oneclaw.md`、`docs/install/oneclaw-install-matrix.md` 以及 `docs/use-cases/*`，把决策页、安装路径页和高价值使用场景页补齐。
- 在 `docs/index.md` 追加 OneClaw 专属入口区块，让首页不再只有上游叙事，也能承接 OneClaw 用户。
- 继续补任务型 AI SEO 页面，新增 `docs/install/oneclaw-on-wsl2.md`、`docs/use-cases/telegram-personal-assistant.md` 和 `docs/use-cases/always-on-vps.md`，把 Windows 安装、Telegram 助手和 24/7 VPS 托管三类高意图问题单独承接。
- 同步更新 `docs/help/faq.md`、`docs/docs.json`、`docs/llms.txt`、`docs/oneclaw.md` 和首页入口，让 OneClaw 的搜索入口从“品牌介绍”扩展到“具体任务与部署问题”。
- 第四轮继续补“证据页”和“转化页”，新增 `docs/oneclaw-examples.md` 与 `docs/compare/why-not-just-openclaw.md`，把截图证据、真实公开案例和“为什么不是直接用上游”这类问题单独落到页面上。
- 同步把这批页面接入 `docs/index.md`、`docs/help/faq.md`、`docs/llms.txt`、`docs/use-cases/index.md` 与 `docs/docs.json`，让 OneClaw 的 AI SEO 从“能被找到”推进到“能被证明、能被说服”。

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
