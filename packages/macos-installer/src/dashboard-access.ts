import { buildComposeCliRunArgs } from "./compose.js";
import { DEFAULT_ONECLAW_GATEWAY_PORT, OPENCLAW_VERSION_SOURCE_URL } from "./constants.js";
import { runCommand, runCommandLogged } from "./shell.js";

type LogFn = (line: string, level?: "info" | "error") => void;

const LOCAL_DASHBOARD_ORIGIN = `http://127.0.0.1:${DEFAULT_ONECLAW_GATEWAY_PORT}`;

export async function ensureInstallerDashboardAccess(
  repoRoot: string,
  composeEnv: NodeJS.ProcessEnv,
  onLog?: LogFn,
): Promise<void> {
  await ensureControlUiAllowedOrigins(repoRoot, composeEnv, onLog);
  await ensureControlUiAllowInsecureAuth(repoRoot, composeEnv, onLog);
  await ensureControlUiDeviceAuthDisabled(repoRoot, composeEnv, onLog);
  await ensureInstallerUpdateVersionSource(repoRoot, composeEnv, onLog);
}

async function ensureControlUiAllowedOrigins(
  repoRoot: string,
  composeEnv: NodeJS.ProcessEnv,
  onLog?: LogFn,
): Promise<void> {
  const currentOrigins = parseStringListConfigValue(
    await readComposeConfigValue(repoRoot, composeEnv, "gateway.controlUi.allowedOrigins"),
  );
  if (currentOrigins.includes(LOCAL_DASHBOARD_ORIGIN)) {
    onLog?.("已确认本地 Control UI 来源白名单。");
    return;
  }

  const nextOrigins =
    currentOrigins.length > 0
      ? [...currentOrigins, LOCAL_DASHBOARD_ORIGIN]
      : [LOCAL_DASHBOARD_ORIGIN];
  onLog?.(`正在写入本地 Control UI 来源白名单 ${JSON.stringify(nextOrigins)}。`);
  await runComposeLogged(
    repoRoot,
    composeEnv,
    await buildComposeCliRunArgs(repoRoot, composeEnv, [
      "config",
      "set",
      "gateway.controlUi.allowedOrigins",
      JSON.stringify(nextOrigins),
      "--strict-json",
    ]),
    onLog,
  );
}

async function ensureControlUiAllowInsecureAuth(
  repoRoot: string,
  composeEnv: NodeJS.ProcessEnv,
  onLog?: LogFn,
): Promise<void> {
  const current = (
    await readComposeConfigValue(repoRoot, composeEnv, "gateway.controlUi.allowInsecureAuth")
  )?.trim();
  if (current === "true") {
    onLog?.("已启用本地 Dashboard 共享鉴权模式。");
    return;
  }

  onLog?.("正在启用本地 Dashboard 共享鉴权模式。");
  await runComposeLogged(
    repoRoot,
    composeEnv,
    await buildComposeCliRunArgs(repoRoot, composeEnv, [
      "config",
      "set",
      "gateway.controlUi.allowInsecureAuth",
      "true",
    ]),
    onLog,
  );
}

async function ensureControlUiDeviceAuthDisabled(
  repoRoot: string,
  composeEnv: NodeJS.ProcessEnv,
  onLog?: LogFn,
): Promise<void> {
  const current = (
    await readComposeConfigValue(
      repoRoot,
      composeEnv,
      "gateway.controlUi.dangerouslyDisableDeviceAuth",
    )
  )?.trim();
  if (current === "true") {
    onLog?.("已启用本地 Dashboard 免设备身份模式。");
    return;
  }

  onLog?.("正在启用本地 Dashboard 免设备身份模式。");
  await runComposeLogged(
    repoRoot,
    composeEnv,
    await buildComposeCliRunArgs(repoRoot, composeEnv, [
      "config",
      "set",
      "gateway.controlUi.dangerouslyDisableDeviceAuth",
      "true",
    ]),
    onLog,
  );
}

async function ensureInstallerUpdateVersionSource(
  repoRoot: string,
  composeEnv: NodeJS.ProcessEnv,
  onLog?: LogFn,
): Promise<void> {
  const current = (
    await readComposeConfigValue(repoRoot, composeEnv, "update.versionSourceUrl")
  )?.trim();
  if (current === OPENCLAW_VERSION_SOURCE_URL) {
    onLog?.("已确认 OneClaw 固定版本源。");
    return;
  }

  onLog?.("正在写入 OneClaw 固定版本源。");
  await runComposeLogged(
    repoRoot,
    composeEnv,
    await buildComposeCliRunArgs(repoRoot, composeEnv, [
      "config",
      "set",
      "update.versionSourceUrl",
      OPENCLAW_VERSION_SOURCE_URL,
    ]),
    onLog,
  );
}

async function readComposeConfigValue(
  repoRoot: string,
  composeEnv: NodeJS.ProcessEnv,
  key: string,
): Promise<string | null> {
  const result = await runCommand(
    "docker",
    ["compose", ...(await buildComposeCliRunArgs(repoRoot, composeEnv, ["config", "get", key]))],
    {
      cwd: repoRoot,
      env: { ...process.env, ...composeEnv },
    },
  );
  if (result.code !== 0) {
    return null;
  }
  return result.stdout.replace(/\r/g, "").trim();
}

function parseStringListConfigValue(raw: string | null): string[] {
  if (!raw || raw === "null" || raw === "[]") {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0);
    }
  } catch {
    // Fall back to single-string handling below.
  }

  return raw.trim() ? [raw.trim()] : [];
}

async function runComposeLogged(
  repoRoot: string,
  composeEnv: NodeJS.ProcessEnv,
  args: string[],
  onLog?: LogFn,
): Promise<void> {
  await runCommandLogged("docker", ["compose", ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...composeEnv },
    onLine: onLog ? (line, level) => onLog(line, level) : undefined,
  });
}
