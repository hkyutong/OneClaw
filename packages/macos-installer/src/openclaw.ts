import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ONECLAW_INSTALL_BUNDLE_LABEL, ONECLAW_INSTALL_BUNDLE_TAG } from "@oneclaw/installer-core";
import { buildComposeCliRunArgs } from "./compose.js";
import {
  DEFAULT_ONECLAW_BRIDGE_PORT,
  DEFAULT_ONECLAW_GATEWAY_BIND,
  DEFAULT_ONECLAW_GATEWAY_PORT,
  OPENCLAW_DOCKER_IMAGE,
  OPENCLAW_REPO_ARCHIVE_URL,
} from "./constants.js";
import { ensureInstallerDashboardAccess } from "./dashboard-access.js";
import { getDockerConfigDir, getDockerWorkspaceDir } from "./paths.js";
import { runCommand, runCommandChecked, runCommandLogged } from "./shell.js";
import type { MacInstallerPaths } from "./types.js";
import { ensureDir, pathExists, writeExecutableFile } from "./utils.js";

export interface OpenClawInstallResult {
  packageSpec: string;
  openclawBin: string;
  version: string;
  onboardScriptPath: string;
  doctorScriptPath: string;
}

export async function ensureDockerWorkspacePrepared(
  paths: MacInstallerPaths,
  onLog: (line: string, level?: "info" | "error") => void,
): Promise<OpenClawInstallResult> {
  const repoRoot = paths.packagePrefix;
  const setupScriptPath = path.join(repoRoot, "docker-setup.sh");
  const composeFilePath = path.join(repoRoot, "docker-compose.yml");

  if ((await pathExists(setupScriptPath)) && (await pathExists(composeFilePath))) {
    onLog(`复用已存在的 ${ONECLAW_INSTALL_BUNDLE_LABEL} Docker 工作区。`);
    await ensureDockerComposeLoopbackPorts(repoRoot, onLog);
    const launchers = await createLauncherScripts(paths);

    return {
      packageSpec: OPENCLAW_DOCKER_IMAGE,
      openclawBin: repoRoot,
      version: ONECLAW_INSTALL_BUNDLE_LABEL,
      onboardScriptPath: launchers.onboardScriptPath,
      doctorScriptPath: launchers.doctorScriptPath,
    };
  }

  return prepareDockerWorkspace(paths, onLog);
}

export async function prepareDockerWorkspace(
  paths: MacInstallerPaths,
  onLog: (line: string, level?: "info" | "error") => void,
): Promise<OpenClawInstallResult> {
  const repoRoot = paths.packagePrefix;
  const repoWorkspaceRoot = path.dirname(repoRoot);
  const archivePath = path.join(
    paths.downloadsRoot,
    `oneclaw-docker-bundle-${ONECLAW_INSTALL_BUNDLE_TAG}.tar.gz`,
  );

  await ensureDir(paths.downloadsRoot);
  await ensureDir(repoWorkspaceRoot);
  await ensureDir(paths.scriptsRoot);
  await ensureDir(paths.applicationsRoot);

  await rm(repoRoot, { recursive: true, force: true });

  onLog(`开始下载 ${ONECLAW_INSTALL_BUNDLE_LABEL} 固定安装包：${OPENCLAW_REPO_ARCHIVE_URL}`);
  await runCommandLogged(
    "curl",
    [
      "--location",
      "--fail",
      "--silent",
      "--show-error",
      OPENCLAW_REPO_ARCHIVE_URL,
      "--output",
      archivePath,
    ],
    {
      onLine: (line, level) => onLog(line, level),
    },
  );

  onLog(`开始解压 ${ONECLAW_INSTALL_BUNDLE_LABEL} 固定安装包。`);
  await runCommandLogged("tar", ["-xzf", archivePath, "-C", repoWorkspaceRoot], {
    onLine: (line, level) => onLog(line, level),
  });
  await rm(archivePath, { force: true });

  const setupScriptPath = path.join(repoRoot, "docker-setup.sh");
  const composeFilePath = path.join(repoRoot, "docker-compose.yml");

  if (!(await pathExists(setupScriptPath)) || !(await pathExists(composeFilePath))) {
    throw new Error("OneClaw Docker 安装文件不完整，请重新执行安装准备。");
  }

  await ensureDockerComposeLoopbackPorts(repoRoot, onLog);
  onLog(`已固定到 ${ONECLAW_INSTALL_BUNDLE_LABEL}（${ONECLAW_INSTALL_BUNDLE_TAG}）。`);

  const launchers = await createLauncherScripts(paths);

  return {
    packageSpec: OPENCLAW_DOCKER_IMAGE,
    openclawBin: repoRoot,
    version: ONECLAW_INSTALL_BUNDLE_LABEL,
    onboardScriptPath: launchers.onboardScriptPath,
    doctorScriptPath: launchers.doctorScriptPath,
  };
}

export async function launchOnboardingInTerminal(paths: MacInstallerPaths): Promise<{
  onboardScriptPath: string;
  doctorScriptPath: string;
}> {
  const onboardScriptPath = path.join(paths.applicationsRoot, "OneClaw Docker Setup.command");
  const doctorScriptPath = path.join(paths.applicationsRoot, "OneClaw Docker Verify.command");

  if (!(await pathExists(onboardScriptPath))) {
    throw new Error("尚未生成 Docker 设置脚本，请先执行安装准备。");
  }

  await runCommand("open", ["-a", "Terminal", onboardScriptPath]);

  return {
    onboardScriptPath,
    doctorScriptPath,
  };
}

export async function launchDoctorInTerminal(paths: MacInstallerPaths): Promise<{
  doctorScriptPath: string;
}> {
  const doctorScriptPath = path.join(paths.applicationsRoot, "OneClaw Docker Verify.command");

  if (!(await pathExists(doctorScriptPath))) {
    throw new Error("尚未生成 Docker 验证脚本，请先执行安装准备。");
  }

  await runCommand("open", ["-a", "Terminal", doctorScriptPath]);

  return {
    doctorScriptPath,
  };
}

export async function launchDashboardInBrowser(
  paths: MacInstallerPaths,
  locale?: string,
): Promise<{
  dashboardUrl: string;
}> {
  const repoRoot = paths.packagePrefix;
  const composeFilePath = path.join(repoRoot, "docker-compose.yml");
  const composeEnv = getDockerComposeEnvironment(paths);

  if (!(await pathExists(composeFilePath))) {
    throw new Error("尚未生成 Docker 工作区，请先完成安装准备。");
  }

  await ensureInstallerDashboardAccess(repoRoot, composeEnv);
  const pendingBefore = await listPendingDashboardRequests(repoRoot, composeEnv);

  const result = await runCommandChecked(
    "docker",
    [
      "compose",
      ...(await buildComposeCliRunArgs(repoRoot, composeEnv, ["dashboard", "--no-open"])),
    ],
    {
      cwd: repoRoot,
      env: composeEnv,
    },
  );
  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  const match = combinedOutput.match(/Dashboard URL:\s*(\S+)/);

  if (!match?.[1]) {
    throw new Error("未能解析 OneClaw 图形界面地址，请稍后重试。");
  }

  const dashboardUrl = applyDashboardLocale(match[1], locale);
  await runCommandChecked("open", [dashboardUrl]);
  await wait(1200);
  const approved = await approveLatestLocalDashboardRequest(repoRoot, composeEnv, pendingBefore);
  if (approved) {
    await wait(400);
    await runCommandChecked("open", [dashboardUrl]);
  }

  return {
    dashboardUrl,
  };
}

function applyDashboardLocale(dashboardUrl: string, locale?: string): string {
  const normalized = locale?.trim();
  if (!normalized) {
    return dashboardUrl;
  }

  try {
    const parsed = new URL(dashboardUrl);
    parsed.searchParams.set("locale", normalized);
    return parsed.toString();
  } catch {
    return dashboardUrl;
  }
}

export function getEmbeddedDockerSetupCommand(paths: MacInstallerPaths): {
  file: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
} {
  const repoRoot = paths.packagePrefix;

  return {
    file: "/bin/zsh",
    args: [
      "-lc",
      [
        `cd ${shellQuote(repoRoot)}`,
        `export ONECLAW_IMAGE=${shellQuote(OPENCLAW_DOCKER_IMAGE)}`,
        `export ONECLAW_CONFIG_DIR=${shellQuote(getDockerConfigDir(paths.home))}`,
        `export ONECLAW_WORKSPACE_DIR=${shellQuote(getDockerWorkspaceDir(paths.home))}`,
        `export OPENCLAW_IMAGE=${shellQuote(OPENCLAW_DOCKER_IMAGE)}`,
        `export OPENCLAW_CONFIG_DIR=${shellQuote(getDockerConfigDir(paths.home))}`,
        `export OPENCLAW_WORKSPACE_DIR=${shellQuote(getDockerWorkspaceDir(paths.home))}`,
        "./docker-setup.sh",
      ].join(" && "),
    ],
    cwd: repoRoot,
    env: {
      ...process.env,
      ...getDockerComposeEnvironment(paths),
    },
  };
}

export function getDockerComposeEnvironment(paths: MacInstallerPaths): NodeJS.ProcessEnv {
  const configDir = getDockerConfigDir(paths.home);
  const workspaceDir = getDockerWorkspaceDir(paths.home);

  return {
    ...process.env,
    ONECLAW_IMAGE: OPENCLAW_DOCKER_IMAGE,
    ONECLAW_CONFIG_DIR: configDir,
    ONECLAW_WORKSPACE_DIR: workspaceDir,
    ONECLAW_GATEWAY_PORT: String(DEFAULT_ONECLAW_GATEWAY_PORT),
    ONECLAW_BRIDGE_PORT: String(DEFAULT_ONECLAW_BRIDGE_PORT),
    ONECLAW_GATEWAY_BIND: DEFAULT_ONECLAW_GATEWAY_BIND,
    OPENCLAW_IMAGE: OPENCLAW_DOCKER_IMAGE,
    OPENCLAW_CONFIG_DIR: configDir,
    OPENCLAW_WORKSPACE_DIR: workspaceDir,
    OPENCLAW_GATEWAY_PORT: String(DEFAULT_ONECLAW_GATEWAY_PORT),
    OPENCLAW_BRIDGE_PORT: String(DEFAULT_ONECLAW_BRIDGE_PORT),
    OPENCLAW_GATEWAY_BIND: DEFAULT_ONECLAW_GATEWAY_BIND,
  };
}

async function listPendingDashboardRequests(
  repoRoot: string,
  env: NodeJS.ProcessEnv,
): Promise<DashboardPairingRequest[]> {
  try {
    const result = await runCommandChecked(
      "docker",
      ["compose", ...(await buildComposeCliRunArgs(repoRoot, env, ["devices", "list", "--json"]))],
      {
        cwd: repoRoot,
        env,
      },
    );
    const payload = JSON.parse(result.stdout) as {
      pending?: DashboardPairingRequest[];
    };

    return (payload.pending ?? []).filter(isLocalDashboardRequest);
  } catch {
    return [];
  }
}

async function approveLatestLocalDashboardRequest(
  repoRoot: string,
  env: NodeJS.ProcessEnv,
  previousPending: DashboardPairingRequest[],
): Promise<boolean> {
  const previousIds = new Set(previousPending.map((item) => item.requestId));
  const pendingNow = await listPendingDashboardRequests(repoRoot, env);
  let nextRequest: DashboardPairingRequest | undefined;

  for (const item of pendingNow) {
    if (previousIds.has(item.requestId)) {
      continue;
    }

    if (!nextRequest || (item.ts ?? 0) > (nextRequest.ts ?? 0)) {
      nextRequest = item;
    }
  }

  if (!nextRequest) {
    for (const item of pendingNow) {
      if (!nextRequest || (item.ts ?? 0) > (nextRequest.ts ?? 0)) {
        nextRequest = item;
      }
    }
  }

  if (!nextRequest?.requestId) {
    return false;
  }

  await runCommandChecked(
    "docker",
    [
      "compose",
      ...(await buildComposeCliRunArgs(repoRoot, env, [
        "devices",
        "approve",
        nextRequest.requestId,
        "--json",
      ])),
    ],
    {
      cwd: repoRoot,
      env,
    },
  );
  return true;
}

function isLocalDashboardRequest(request: DashboardPairingRequest): boolean {
  const remoteIp = request.remoteIp?.trim() ?? "";
  const localDockerLike =
    !remoteIp ||
    remoteIp === "127.0.0.1" ||
    remoteIp === "::1" ||
    remoteIp.startsWith("192.168.65.") ||
    remoteIp.startsWith("172.17.") ||
    remoteIp.startsWith("172.18.");

  return (
    (request.clientId === "openclaw-control-ui" || request.clientId === "oneclaw-control-ui") &&
    request.clientMode === "webchat" &&
    request.role === "operator" &&
    localDockerLike
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

interface DashboardPairingRequest {
  requestId: string;
  clientId?: string;
  clientMode?: string;
  role?: string;
  remoteIp?: string;
  ts?: number;
}

async function createLauncherScripts(paths: MacInstallerPaths): Promise<{
  onboardScriptPath: string;
  doctorScriptPath: string;
}> {
  const repoRoot = paths.packagePrefix;
  const configDir = getDockerConfigDir(paths.home);
  const workspaceDir = getDockerWorkspaceDir(paths.home);

  await ensureDir(configDir);
  await ensureDir(workspaceDir);
  await ensureDir(paths.scriptsRoot);
  await ensureDir(paths.applicationsRoot);

  const envPrelude = [
    "#!/bin/zsh",
    "set -e",
    `export ONECLAW_IMAGE=${shellQuote(OPENCLAW_DOCKER_IMAGE)}`,
    `export ONECLAW_CONFIG_DIR=${shellQuote(configDir)}`,
    `export ONECLAW_WORKSPACE_DIR=${shellQuote(workspaceDir)}`,
    `export OPENCLAW_IMAGE=${shellQuote(OPENCLAW_DOCKER_IMAGE)}`,
    `export OPENCLAW_CONFIG_DIR=${shellQuote(configDir)}`,
    `export OPENCLAW_WORKSPACE_DIR=${shellQuote(workspaceDir)}`,
    `cd ${shellQuote(repoRoot)}`,
    "",
  ].join("\n");

  const onboardScript = [
    envPrelude,
    "clear",
    "echo 'OneClaw 安装器正在启动 OneClaw Docker 安装流程...'",
    "./docker-setup.sh",
    "code=$?",
    "echo ''",
    "echo '安装流程已结束。按回车关闭这个窗口。'",
    "read _",
    "exit $code",
    "",
  ].join("\n");

  const doctorScript = [
    envPrelude,
    "clear",
    "echo 'OneClaw 安装器正在运行 OneClaw Doctor...'",
    "if docker compose exec -T oneclaw-gateway true >/dev/null 2>&1; then",
    "  docker compose run --rm -T --no-deps oneclaw-cli doctor",
    "else",
    "  docker compose run --rm -T oneclaw-cli doctor",
    "fi",
    "code=$?",
    "echo ''",
    "echo '验证已结束。按回车关闭这个窗口。'",
    "read _",
    "exit $code",
    "",
  ].join("\n");

  const onboardScriptPath = path.join(paths.applicationsRoot, "OneClaw Docker Setup.command");
  const doctorScriptPath = path.join(paths.applicationsRoot, "OneClaw Docker Verify.command");

  await writeExecutableFile(onboardScriptPath, onboardScript);
  await writeExecutableFile(doctorScriptPath, doctorScript);

  return {
    onboardScriptPath,
    doctorScriptPath,
  };
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

async function ensureDockerComposeLoopbackPorts(
  repoRoot: string,
  onLog: (line: string, level?: "info" | "error") => void,
): Promise<void> {
  const composeFilePath = path.join(repoRoot, "docker-compose.yml");
  let content = await readFile(composeFilePath, "utf8");
  const original = content;

  content = content.replace(
    '- "${OPENCLAW_GATEWAY_PORT:-18789}:18789"',
    '- "127.0.0.1:${OPENCLAW_GATEWAY_PORT:-18789}:18789"',
  );
  content = content.replace(
    '- "${OPENCLAW_BRIDGE_PORT:-18790}:18790"',
    '- "127.0.0.1:${OPENCLAW_BRIDGE_PORT:-18790}:18790"',
  );
  content = content.replace(
    '- "${ONECLAW_GATEWAY_PORT:-18789}:18789"',
    '- "127.0.0.1:${ONECLAW_GATEWAY_PORT:-18789}:18789"',
  );
  content = content.replace(
    '- "${ONECLAW_BRIDGE_PORT:-18790}:18790"',
    '- "127.0.0.1:${ONECLAW_BRIDGE_PORT:-18790}:18790"',
  );

  if (content === original) {
    onLog("已确认 Docker 端口仅绑定本机回环地址。");
    return;
  }

  await writeFile(composeFilePath, content, "utf8");
  onLog("已将 Docker 端口绑定限制为 127.0.0.1。");
}
