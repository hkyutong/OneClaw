# apps/desktop-installer

这里是 `OneClaw Installer` 的桌面端，目前用 `Electron + Vite + React + TypeScript` 组成跨平台桌面壳。

当前已实现：

- `macOS` 引导式安装向导
- 中英双语切换
- Docker 预检、官方安装资源准备与最终验证入口
- Electron 主进程托管 `macOS` 本地安装后端
- App 内嵌官方设置会话，必要时可切回外部 Terminal

本地运行：

```bash
npm run dev:desktop
```

如果只想在浏览器里调试当前前端和本地后端，也可以运行：

```bash
npm run dev:web
```
