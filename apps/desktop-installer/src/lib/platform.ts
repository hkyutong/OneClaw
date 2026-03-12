import type { DesktopPlatform } from "@oneclaw/installer-core";

export type PreflightState = "ready" | "attention" | "blocked" | "pending";

export interface PreflightItem {
  id: string;
  title: string;
  detail: string;
  state: PreflightState;
}

export interface PreflightInput {
  platform: DesktopPlatform;
  hasWsl2: boolean;
  managedRuntime: boolean;
}

export function detectLikelyPlatform(): DesktopPlatform {
  if (typeof navigator === "undefined") {
    return "macos";
  }

  const source = [
    navigator.userAgent,
    navigator.platform
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (source.includes("win")) {
    return "windows";
  }

  if (source.includes("linux") || source.includes("x11")) {
    return "linux";
  }

  return "macos";
}

export function getPlatformLabel(platform: DesktopPlatform): string {
  switch (platform) {
    case "macos":
      return "macOS";
    case "linux":
      return "Linux";
    case "windows":
      return "Windows";
  }
}

export function createPreflightItems(
  input: PreflightInput
): PreflightItem[] {
  if (input.platform === "windows") {
    return [
      {
        id: "host",
        title: "Windows 宿主检测",
        detail: "确认系统版本、可用磁盘空间和图形入口创建能力。",
        state: "ready"
      },
      {
        id: "wsl2",
        title: "WSL2 状态",
        detail: input.hasWsl2
          ? "检测到 WSL2，可继续准备 Linux 发行版与 Node 运行时。"
          : "未启用 WSL2。MVP 会在这里阻断，并转入启用流程。",
        state: input.hasWsl2 ? "ready" : "blocked"
      },
      {
        id: "admin",
        title: "管理员授权",
        detail: "启用 WSL2 与系统特性时需要申请管理员权限。",
        state: input.hasWsl2 ? "attention" : "pending"
      },
      {
        id: "network",
        title: "网络与官方源",
        detail: "后续将从官方源拉取 OpenClaw 与相关元数据。",
        state: "attention"
      }
    ];
  }

  return [
    {
      id: "os",
      title: `${getPlatformLabel(input.platform)} 平台兼容性`,
      detail: "当前桌面端默认按官方 Docker 路线规划安装流程。",
      state: "ready"
    },
    {
      id: "runtime",
      title: "Docker 环境",
      detail: "应用会检查 Docker Desktop、Docker Compose 和官方安装资源。",
      state: "attention"
    },
    {
      id: "service",
      title: "官方设置流程",
      detail:
        input.platform === "macos"
          ? "当前 macOS 版本会承接 OpenClaw 官方 docker-setup.sh。"
          : "当前 Linux 版本也会优先复用官方 Docker 设置流程。",
      state: "attention"
    },
    {
      id: "network",
      title: "网络与校验",
      detail: "安装器会记录官方来源 URL、镜像引用和日志。",
      state: "attention"
    }
  ];
}

export function summarizePreflight(items: PreflightItem[]): Record<PreflightState, number> {
  return items.reduce<Record<PreflightState, number>>(
    (summary, item) => {
      summary[item.state] += 1;
      return summary;
    },
    {
      ready: 0,
      attention: 0,
      blocked: 0,
      pending: 0
    }
  );
}
