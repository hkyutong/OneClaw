import path from "node:path";
import {
  ONECLAW_INSTALL_BUNDLE_LABEL,
  ONECLAW_INSTALL_BUNDLE_REF_URL,
} from "@oneclaw/installer-core";
import {
  DEFAULT_NODE_VERSION,
  DEFAULT_OPENCLAW_VERSION,
  MIN_FREE_DISK_BYTES,
  OPENCLAW_REGISTRY_URL,
} from "./constants.js";
import { getDockerConfigDir, getDockerWorkspaceDir, getInstallerPaths } from "./paths.js";
import { resolveCommandPath, runCommand } from "./shell.js";
import type { MacCheck, MacInspection, MacInstallerConfig, VersionProbe } from "./types.js";
import { ensureDir, getDiskFreeBytes, pathExists } from "./utils.js";

export async function inspectMacSystem(config: MacInstallerConfig = {}): Promise<MacInspection> {
  const paths = getInstallerPaths(config.home);
  await ensureDir(paths.home);
  await ensureDir(paths.logsRoot);

  const [
    osVersion,
    diskFreeBytes,
    dockerCompose,
    dockerCli,
    dockerWorkspace,
    dockerEngine,
    dockerSetupState,
    bundleRefReachable,
    archiveReachable,
  ] = await Promise.all([
    readMacOsVersion(),
    getDiskFreeBytes(paths.home),
    probeDockerCompose(),
    probeDockerCli(),
    probeDockerWorkspace(paths.packagePrefix),
    probeDockerEngine(),
    probeDockerSetup(paths.packagePrefix, paths.home),
    checkUrlReachable(ONECLAW_INSTALL_BUNDLE_REF_URL),
    checkUrlReachable(OPENCLAW_REGISTRY_URL),
  ]);

  const networkState = dockerWorkspace.installed
    ? "ready"
    : bundleRefReachable && archiveReachable
      ? "ready"
      : bundleRefReachable || archiveReachable
        ? "attention"
        : "blocked";

  const networkDetail = dockerWorkspace.installed
    ? "本机已经存在 OneClaw Docker 工作区，后续步骤不依赖重新下载官方源。"
    : bundleRefReachable && archiveReachable
      ? `OneClaw 固定安装版本 ${ONECLAW_INSTALL_BUNDLE_LABEL} 与对应源码包都可访问。`
      : bundleRefReachable || archiveReachable
        ? `OneClaw 固定安装版本 ${ONECLAW_INSTALL_BUNDLE_LABEL} 只有一部分可访问。通常仍可继续准备安装资源，或稍后切换网络后再试。`
        : `当前无法访问 OneClaw 固定安装版本 ${ONECLAW_INSTALL_BUNDLE_LABEL} 的 Git tag 与源码包地址。`;

  const checks: MacCheck[] = [
    {
      id: "arch",
      title: "macOS 主机架构",
      state:
        process.platform === "darwin" && (process.arch === "arm64" || process.arch === "x64")
          ? "ready"
          : "blocked",
      detail: `当前检测到 ${process.platform} / ${process.arch}。`,
    },
    {
      id: "disk",
      title: "可用磁盘空间",
      state: diskFreeBytes >= MIN_FREE_DISK_BYTES ? "ready" : "blocked",
      detail: `当前可用约 ${(diskFreeBytes / 1024 / 1024 / 1024).toFixed(1)} GiB，建议至少 4 GiB。`,
    },
    {
      id: "home",
      title: "安装目录可写",
      state: "ready",
      detail: `将使用 ${paths.home} 保存 Docker 安装包、日志和工作目录。`,
    },
    {
      id: "network",
      title: "OneClaw 源可达",
      state: networkState,
      detail: networkDetail,
    },
    {
      id: "docker",
      title: "Docker CLI",
      state: dockerCli.installed ? "ready" : "blocked",
      detail: dockerCli.installed
        ? `检测到 ${dockerCli.version ?? "Docker CLI"}。`
        : "未检测到 Docker CLI。请先安装并启动 Docker Desktop。",
    },
    {
      id: "compose",
      title: "Docker Compose",
      state: dockerCompose.installed ? "ready" : "blocked",
      detail: dockerCompose.installed
        ? `检测到 ${dockerCompose.version ?? "Docker Compose"}。`
        : "未检测到 docker compose。请升级 Docker Desktop。",
    },
    {
      id: "engine",
      title: "Docker Engine",
      state: dockerEngine.installed ? "ready" : "blocked",
      detail: dockerEngine.installed
        ? "Docker Engine 正在运行。"
        : "Docker Engine 未运行。请先打开 Docker Desktop。",
    },
    {
      id: "workspace",
      title: "OneClaw 工作区",
      state: dockerWorkspace.installed ? "ready" : "attention",
      detail: dockerWorkspace.installed
        ? `已检测到 OneClaw Docker 工作区：${dockerWorkspace.path ?? paths.packagePrefix}`
        : "尚未准备 OneClaw Docker 工作区，安装准备阶段会自动下载。",
    },
  ];

  return {
    checkedAt: new Date().toISOString(),
    platform: "macos",
    arch: process.arch,
    osVersion,
    nodeRequirement: "Docker Desktop + Docker Compose",
    latestNodeVersion: DEFAULT_NODE_VERSION,
    latestOpenClawVersion: DEFAULT_OPENCLAW_VERSION,
    paths,
    diskFreeBytes,
    systemNode: dockerCompose,
    managedNode: dockerCli,
    openclaw: dockerWorkspace,
    setupCompleted: dockerSetupState.completed,
    gatewayRunning: dockerSetupState.gatewayRunning,
    checks,
  };
}

async function readMacOsVersion(): Promise<string> {
  const result = await runCommand("sw_vers", ["-productVersion"]);
  return result.stdout.trim();
}

async function probeDockerCli(): Promise<VersionProbe> {
  try {
    const dockerBinary = await resolveCommandPath("docker");
    const version = await runCommand(dockerBinary, ["--version"]);
    return {
      installed: true,
      path: dockerBinary,
      version: version.stdout.trim(),
    };
  } catch {
    return {
      installed: false,
    };
  }
}

async function probeDockerCompose(): Promise<VersionProbe> {
  try {
    const dockerBinary = await resolveCommandPath("docker");
    const version = await runCommand(dockerBinary, ["compose", "version"]);
    return {
      installed: true,
      path: dockerBinary,
      version: version.stdout.trim(),
    };
  } catch {
    return {
      installed: false,
    };
  }
}

async function probeDockerEngine(): Promise<VersionProbe> {
  try {
    const dockerBinary = await resolveCommandPath("docker");
    const info = await runCommand(dockerBinary, ["info", "--format", "{{.ServerVersion}}"]);
    return {
      installed: true,
      path: dockerBinary,
      version: info.stdout.trim(),
    };
  } catch {
    return {
      installed: false,
    };
  }
}

async function probeDockerWorkspace(repoRoot: string): Promise<VersionProbe> {
  const setupScriptPath = path.join(repoRoot, "docker-setup.sh");
  const composeFilePath = path.join(repoRoot, "docker-compose.yml");

  if ((await pathExists(setupScriptPath)) && (await pathExists(composeFilePath))) {
    return {
      installed: true,
      version: `${DEFAULT_OPENCLAW_VERSION}（已固定）`,
      path: repoRoot,
    };
  }

  return {
    installed: false,
  };
}

async function probeDockerSetup(
  repoRoot: string,
  home: string,
): Promise<{
  completed: boolean;
  gatewayRunning: boolean;
}> {
  const configPath = path.join(getDockerConfigDir(home), "openclaw.json");
  const workspaceDir = getDockerWorkspaceDir(home);
  const configReady = await pathExists(configPath);

  if (!configReady) {
    return {
      completed: false,
      gatewayRunning: false,
    };
  }

  try {
    const docker = await resolveCommandPath("docker");
    const services = await runCommand(
      docker,
      ["compose", "ps", "--services", "--status", "running"],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          ONECLAW_IMAGE: DEFAULT_OPENCLAW_VERSION,
          ONECLAW_CONFIG_DIR: getDockerConfigDir(home),
          ONECLAW_WORKSPACE_DIR: workspaceDir,
          OPENCLAW_IMAGE: DEFAULT_OPENCLAW_VERSION,
          OPENCLAW_CONFIG_DIR: getDockerConfigDir(home),
          OPENCLAW_WORKSPACE_DIR: workspaceDir,
        },
      },
    );

    return {
      completed: true,
      gatewayRunning:
        services.code === 0 &&
        services.stdout.split("\n").some((line) => line.trim() === "oneclaw-gateway"),
    };
  } catch {
    return {
      completed: true,
      gatewayRunning: false,
    };
  }
}

async function checkUrlReachable(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}
