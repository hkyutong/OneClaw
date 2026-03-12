import type {
  DesktopPlatform,
  InstallPlan,
  InstallSource,
  InstallStep,
  InstallStrategy,
  InstallWarning,
  PlannerInput,
  ReleaseChannel,
  StepKind,
} from "./model.js";

export { OPENCLAW_NODE_MIN_VERSION } from "./model.js";

const DEFAULT_OFFICIAL_SOURCES: InstallSource[] = [
  {
    name: "OneClaw GitHub",
    url: "https://github.com/hkyutong/OneClaw",
    reason: "OneClaw 的主仓库，包含安装说明、版本入口和项目主页。",
  },
  {
    name: "OneClaw Docker Setup",
    url: "https://github.com/hkyutong/OneClaw/blob/main/docker-setup.sh",
    reason: "OneClaw 安装器调用的标准 Docker 安装脚本来源。",
  },
  {
    name: "OneClaw API Docs",
    url: "https://docs.openclaw.ai/gateway/authentication",
    reason: "OneClaw 当前沿用的上游 API 配置参考文档。",
  },
];

export function createInstallPlan(input: PlannerInput): InstallPlan {
  const channel = input.channel ?? "stable";
  const strategy = pickStrategy(input.platform);
  const warnings = collectWarnings(input.platform, input.hasWsl2, channel);

  return {
    platform: input.platform,
    channel,
    strategy,
    steps: buildSteps(strategy, channel),
    warnings,
    sources: DEFAULT_OFFICIAL_SOURCES,
  };
}

function pickStrategy(platform: DesktopPlatform): InstallStrategy {
  if (platform === "windows") {
    return "windows-wsl2-managed-runtime";
  }

  return "native-managed-runtime";
}

function collectWarnings(
  platform: DesktopPlatform,
  hasWsl2: boolean | undefined,
  channel?: ReleaseChannel,
): InstallWarning[] {
  const warnings: InstallWarning[] = [];

  if (platform === "windows" && !hasWsl2) {
    warnings.push({
      code: "WSL2_REQUIRED",
      message: "Windows MVP 仅支持通过 WSL2 安装 OneClaw。",
    });
  }

  if (platform === "macos") {
    warnings.push({
      code: "MAC_APP_FUTURE_INTEGRATION",
      message: "官方 macOS companion app 已存在，后续可补双路径安装。",
    });
  }

  if (channel === "dev") {
    warnings.push({
      code: "DEV_CHANNEL_UNSTABLE",
      message: "dev 通道未保证始终有可用 npm 发布，安装器应在运行前二次确认。",
    });
  }

  return warnings;
}

function buildSteps(strategy: InstallStrategy, channel: ReleaseChannel): InstallStep[] {
  if (strategy === "windows-wsl2-managed-runtime") {
    return [
      step(
        "detect-platform",
        "detect-platform",
        "检测系统与 WSL 状态",
        "确认系统版本、管理员权限、WSL2 与目标 Linux 发行版状态。",
        false,
        true,
      ),
      step(
        "preflight-checks",
        "preflight-checks",
        "执行安装预检",
        "检查磁盘空间、网络连通性和 Windows 特性开关。",
        false,
        true,
      ),
      step(
        "prepare-runtime",
        "prepare-runtime",
        "准备 WSL2 与安装环境",
        "启用 WSL2、初始化发行版，并在 WSL 中准备官方安装环境。",
        true,
        true,
      ),
      step(
        "fetch-openclaw",
        "fetch-openclaw",
        "获取 OneClaw 安装源",
        `解析 ${channel} 通道并下载对应版本的 OneClaw 元数据。`,
        false,
        true,
      ),
      step(
        "install-openclaw",
        "install-openclaw",
        "在 WSL 中安装 OneClaw",
        "通过官方推荐方式在 WSL 环境内完成 OneClaw 安装。",
        false,
        true,
      ),
      step(
        "run-onboarding",
        "run-onboarding",
        "运行官方 onboarding",
        "通过 PTY 桥接执行 oneclaw onboard，并把交互翻译到 GUI。",
        false,
        true,
      ),
      step(
        "install-daemon",
        "install-daemon",
        "安装守护进程",
        "在 WSL 环境内配置 OneClaw 的后台守护进程。",
        false,
        true,
      ),
      step(
        "verify-health",
        "verify-health",
        "验证运行状态",
        "检查 OneClaw Gateway 是否正常启动并返回健康状态。",
        false,
        true,
      ),
      step(
        "create-entrypoints",
        "create-entrypoints",
        "创建 Windows 入口",
        "创建桌面快捷方式、日志入口和重新配置入口。",
        false,
        true,
      ),
      step(
        "finalize",
        "finalize",
        "完成安装",
        "保存安装状态、会话日志和后续维护入口。",
        false,
        false,
      ),
    ];
  }

  return [
    step(
      "detect-platform",
      "detect-platform",
      "检测系统环境",
      "确认平台、CPU 架构、系统版本和基础依赖情况。",
      false,
      true,
    ),
    step(
      "preflight-checks",
      "preflight-checks",
      "执行安装预检",
      "检查磁盘空间、网络连通性、写权限和后台服务能力。",
      false,
      true,
    ),
    step(
      "prepare-runtime",
      "prepare-runtime",
      "准备安装环境",
      "检查 Docker Desktop 与 Docker Compose，并准备官方安装资源。",
      false,
      true,
    ),
    step(
      "fetch-openclaw",
      "fetch-openclaw",
      "下载官方安装资源",
      `获取 ${channel} 通道对应的 OneClaw Docker 资源与配置入口。`,
      false,
      true,
    ),
    step(
      "install-openclaw",
      "install-openclaw",
      "准备 OneClaw 工作区",
      "创建 OneClaw Docker 工作区、启动入口和后续验证入口。",
      false,
      true,
    ),
    step(
      "run-onboarding",
      "run-onboarding",
      "完成官方设置",
      "运行官方 docker-setup.sh 并完成登录、初始化与网关启动。",
      false,
      true,
    ),
    step(
      "install-daemon",
      "install-daemon",
      "启动网关服务",
      "按官方 Docker 流程启动并保持 OneClaw Gateway 运行。",
      false,
      true,
    ),
    step(
      "verify-health",
      "verify-health",
      "完成最后验证",
      "运行 Doctor 或健康检查，确认当前 Mac 已可用。",
      false,
      true,
    ),
    step(
      "create-entrypoints",
      "create-entrypoints",
      "创建入口与维护工具",
      "创建启动入口、日志入口和修复入口。",
      false,
      true,
    ),
    step("finalize", "finalize", "完成安装", "保存安装状态、日志与后续维护信息。", false, false),
  ];
}

function step(
  id: string,
  kind: StepKind,
  title: string,
  description: string,
  requiresElevation: boolean,
  retryable: boolean,
): InstallStep {
  return {
    id,
    kind,
    title,
    description,
    requiresElevation,
    retryable,
  };
}
