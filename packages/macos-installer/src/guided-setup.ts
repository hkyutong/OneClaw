import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_ANTHROPIC_MODEL_ID,
  DEFAULT_ONECLAW_BRIDGE_PORT,
  DEFAULT_ONECLAW_GATEWAY_BIND,
  DEFAULT_ONECLAW_GATEWAY_PORT,
  DEFAULT_OPENAI_MODEL_ID,
  DEFAULT_YUTOAPI_MODEL_ID,
  OPENCLAW_DOCKER_IMAGE,
  YUTOAPI_BASE_URL,
} from "./constants.js";
import { ensureInstallerDashboardAccess } from "./dashboard-access.js";
import { ensureDockerWorkspacePrepared, type OpenClawInstallResult } from "./openclaw.js";
import { getDockerConfigDir, getDockerWorkspaceDir } from "./paths.js";
import { runCommandLogged } from "./shell.js";
import type { GuidedProvider, MacInstallerPaths } from "./types.js";
import { ensureDir } from "./utils.js";

export interface GuidedSetupOptions {
  provider: GuidedProvider;
  apiKey: string;
  modelId: string;
}

export interface GuidedSetupResult extends OpenClawInstallResult {
  configPath: string;
  workspacePath: string;
  healthUrl: string;
}

export async function runGuidedDockerSetup(
  paths: MacInstallerPaths,
  options: GuidedSetupOptions,
  onLog: (line: string, level?: "info" | "error") => void,
): Promise<GuidedSetupResult> {
  const provider = options.provider;
  const apiKey = options.apiKey.trim();
  const modelId = resolveModelId(provider, options.modelId);
  const authArgs = resolveAuthArgs(provider, apiKey, modelId);

  if (!apiKey) {
    throw new Error(`请先填写 ${authArgs.providerLabel} API Key。`);
  }

  const installResult = await ensureDockerWorkspacePrepared(paths, onLog);
  const repoRoot = installResult.openclawBin;
  const composeEnv = getPersistentComposeEnvironment(paths);

  await seedDockerDataDirectories(paths);
  await writeComposeEnvFile(path.join(repoRoot, ".env"), composeEnv);

  await buildDockerImageIfNeeded(repoRoot, composeEnv, onLog);
  await fixDockerPermissions(repoRoot, composeEnv, onLog);

  onLog(`开始自动配置 OneClaw，当前提供商：${authArgs.providerLabel}，模型 ${modelId}。`);
  onLog(authArgs.endpointHint);
  await runComposeLogged(
    repoRoot,
    composeEnv,
    [
      "run",
      "--rm",
      "-T",
      "--no-deps",
      "oneclaw-cli",
      "onboard",
      "--mode",
      "local",
      "--non-interactive",
      "--accept-risk",
      "--no-install-daemon",
      ...authArgs.onboardArgs,
      "--gateway-bind",
      DEFAULT_ONECLAW_GATEWAY_BIND,
      "--skip-channels",
      "--skip-skills",
      "--skip-search",
      "--skip-health",
      "--skip-ui",
    ],
    onLog,
  );

  await runComposeLogged(
    repoRoot,
    composeEnv,
    [
      "run",
      "--rm",
      "-T",
      "--no-deps",
      "oneclaw-cli",
      "config",
      "set",
      "agents.defaults.model.primary",
      authArgs.primaryModel,
    ],
    onLog,
  );

  await runComposeLogged(
    repoRoot,
    composeEnv,
    ["run", "--rm", "-T", "--no-deps", "oneclaw-cli", "config", "set", "gateway.mode", "local"],
    onLog,
  );
  await runComposeLogged(
    repoRoot,
    composeEnv,
    [
      "run",
      "--rm",
      "-T",
      "--no-deps",
      "oneclaw-cli",
      "config",
      "set",
      "gateway.bind",
      DEFAULT_ONECLAW_GATEWAY_BIND,
    ],
    onLog,
  );
  await ensureInstallerDashboardAccess(repoRoot, composeEnv, onLog);

  onLog("正在启动 OneClaw Gateway。");
  await runComposeLogged(repoRoot, composeEnv, ["up", "-d", "oneclaw-gateway"], onLog);

  const healthUrl = `http://127.0.0.1:${DEFAULT_ONECLAW_GATEWAY_PORT}/healthz`;
  await waitForGatewayHealth(healthUrl, onLog);

  return {
    ...installResult,
    configPath: path.join(getDockerConfigDir(paths.home), "openclaw.json"),
    workspacePath: getDockerWorkspaceDir(paths.home),
    healthUrl,
  };
}

function resolveModelId(provider: GuidedProvider, rawModelId: string): string {
  const trimmed = rawModelId.trim();
  if (trimmed) {
    return trimmed;
  }

  switch (provider) {
    case "openai":
      return DEFAULT_OPENAI_MODEL_ID;
    case "anthropic":
      return DEFAULT_ANTHROPIC_MODEL_ID;
    case "yutoapi":
    default:
      return DEFAULT_YUTOAPI_MODEL_ID;
  }
}

function resolveAuthArgs(
  provider: GuidedProvider,
  apiKey: string,
  modelId: string,
): {
  providerLabel: string;
  primaryModel: string;
  endpointHint: string;
  onboardArgs: string[];
} {
  switch (provider) {
    case "openai":
      return {
        providerLabel: "OpenAI",
        primaryModel: prefixModel("openai", modelId),
        endpointHint: "将使用 OpenAI 官方 API，并在初始化后写入默认模型。",
        onboardArgs: ["--auth-choice", "openai-api-key", "--openai-api-key", apiKey],
      };
    case "anthropic":
      return {
        providerLabel: "Claude",
        primaryModel: prefixModel("anthropic", modelId),
        endpointHint: "将使用 Anthropic 官方 API，并在初始化后写入默认模型。",
        onboardArgs: ["--auth-choice", "apiKey", "--anthropic-api-key", apiKey],
      };
    case "yutoapi":
    default:
      return {
        providerLabel: "YutoAPI",
        primaryModel: prefixModel("yutoapi", modelId),
        endpointHint: `安装器会自动使用 ${YUTOAPI_BASE_URL}，无需手动填写 Base URL。`,
        onboardArgs: [
          "--auth-choice",
          "yutoapi-api-key",
          "--yutoapi-api-key",
          apiKey,
          "--custom-model-id",
          modelId,
        ],
      };
  }
}

function prefixModel(provider: string, modelId: string): string {
  return modelId.includes("/") ? modelId : `${provider}/${modelId}`;
}

function getPersistentComposeEnvironment(paths: MacInstallerPaths): Record<string, string> {
  const configDir = getDockerConfigDir(paths.home);
  const workspaceDir = getDockerWorkspaceDir(paths.home);

  return {
    ONECLAW_CONFIG_DIR: configDir,
    ONECLAW_WORKSPACE_DIR: workspaceDir,
    ONECLAW_GATEWAY_PORT: String(DEFAULT_ONECLAW_GATEWAY_PORT),
    ONECLAW_BRIDGE_PORT: String(DEFAULT_ONECLAW_BRIDGE_PORT),
    ONECLAW_GATEWAY_BIND: DEFAULT_ONECLAW_GATEWAY_BIND,
    ONECLAW_IMAGE: OPENCLAW_DOCKER_IMAGE,
    OPENCLAW_CONFIG_DIR: configDir,
    OPENCLAW_WORKSPACE_DIR: workspaceDir,
    OPENCLAW_GATEWAY_PORT: String(DEFAULT_ONECLAW_GATEWAY_PORT),
    OPENCLAW_BRIDGE_PORT: String(DEFAULT_ONECLAW_BRIDGE_PORT),
    OPENCLAW_GATEWAY_BIND: DEFAULT_ONECLAW_GATEWAY_BIND,
    OPENCLAW_IMAGE: OPENCLAW_DOCKER_IMAGE,
  };
}

async function seedDockerDataDirectories(paths: MacInstallerPaths): Promise<void> {
  const configDir = getDockerConfigDir(paths.home);
  const workspaceDir = getDockerWorkspaceDir(paths.home);

  await ensureDir(configDir);
  await ensureDir(workspaceDir);
  await ensureDir(path.join(configDir, "identity"));
  await ensureDir(path.join(configDir, "agents", "main", "agent"));
  await ensureDir(path.join(configDir, "agents", "main", "sessions"));
  await ensureDir(path.join(workspaceDir, ".openclaw"));
}

async function writeComposeEnvFile(
  envFilePath: string,
  entries: Record<string, string>,
): Promise<void> {
  let existing = "";

  try {
    existing = await readFile(envFilePath, "utf8");
  } catch {
    existing = "";
  }

  const lines = existing ? existing.split(/\r?\n/) : [];
  const nextLines: string[] = [];
  const remaining = new Map(Object.entries(entries));

  for (const line of lines) {
    if (!line) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      nextLines.push(line);
      continue;
    }

    const key = line.slice(0, separatorIndex);
    if (remaining.has(key)) {
      nextLines.push(`${key}=${remaining.get(key) ?? ""}`);
      remaining.delete(key);
      continue;
    }

    nextLines.push(line);
  }

  for (const [key, value] of remaining) {
    nextLines.push(`${key}=${value}`);
  }

  await writeFile(envFilePath, `${nextLines.join("\n")}\n`, "utf8");
}

async function buildDockerImageIfNeeded(
  repoRoot: string,
  composeEnv: Record<string, string>,
  onLog: (line: string, level?: "info" | "error") => void,
): Promise<void> {
  if (OPENCLAW_DOCKER_IMAGE !== "oneclaw:local") {
    onLog(`正在拉取 Docker 镜像 ${OPENCLAW_DOCKER_IMAGE}。`);
    await runCommandLogged("docker", ["pull", OPENCLAW_DOCKER_IMAGE], {
      env: { ...process.env, ...composeEnv },
      onLine: (line, level) => onLog(line, level),
    });
    return;
  }

  onLog(`正在构建 Docker 镜像 ${OPENCLAW_DOCKER_IMAGE}，首次执行会稍慢。`);
  await runCommandLogged(
    "docker",
    ["build", "-t", OPENCLAW_DOCKER_IMAGE, "-f", path.join(repoRoot, "Dockerfile"), repoRoot],
    {
      cwd: repoRoot,
      env: { ...process.env, ...composeEnv },
      onLine: (line, level) => onLog(line, level),
    },
  );
}

async function fixDockerPermissions(
  repoRoot: string,
  composeEnv: Record<string, string>,
  onLog: (line: string, level?: "info" | "error") => void,
): Promise<void> {
  onLog("正在修正 OneClaw 数据目录权限。");
  await runComposeLogged(
    repoRoot,
    composeEnv,
    [
      "run",
      "--rm",
      "-T",
      "--no-deps",
      "--user",
      "root",
      "--entrypoint",
      "sh",
      "oneclaw-cli",
      "-c",
      "find /home/node/.openclaw -xdev -exec chown node:node {} +; [ -d /home/node/.openclaw/workspace/.openclaw ] && chown -R node:node /home/node/.openclaw/workspace/.openclaw || true",
    ],
    onLog,
  );
}

async function waitForGatewayHealth(
  healthUrl: string,
  onLog: (line: string, level?: "info" | "error") => void,
): Promise<void> {
  const deadline = Date.now() + 60_000;
  onLog("正在等待 OneClaw Gateway 完成启动。");

  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        onLog("OneClaw Gateway 已通过健康检查。");
        return;
      }
    } catch {
      // Continue polling until timeout.
    }

    await sleep(1500);
  }

  throw new Error("OneClaw Gateway 启动超时，请检查 Docker Desktop 和日志输出。");
}

async function runComposeLogged(
  repoRoot: string,
  composeEnv: Record<string, string>,
  args: string[],
  onLog: (line: string, level?: "info" | "error") => void,
): Promise<void> {
  await runCommandLogged("docker", ["compose", ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...composeEnv },
    onLine: (line, level) => onLog(line, level),
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
