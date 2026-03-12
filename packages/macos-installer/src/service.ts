import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFile, mkdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ReleaseChannel } from "@oneclaw/installer-core";
import { DOCKER_DESKTOP_ARM64_URL, DOCKER_DESKTOP_X64_URL, LOG_TAIL_LIMIT } from "./constants.js";
import { runGuidedDockerSetup } from "./guided-setup.js";
import { OnboardingSessionManager } from "./onboarding-session.js";
import {
  ensureDockerWorkspacePrepared,
  launchDashboardInBrowser,
  prepareDockerWorkspace,
  launchDoctorInTerminal,
  launchOnboardingInTerminal,
} from "./openclaw.js";
import { getInstallerPaths } from "./paths.js";
import { inspectMacSystem } from "./preflight.js";
import { runCommandChecked, runCommandLogged } from "./shell.js";
import type {
  GuidedProvider,
  LaunchDoctorResult,
  LaunchDashboardResult,
  GuidedSetupInput,
  GuidedSetupSessionSnapshot,
  InstallSessionSnapshot,
  LaunchOnboardingResult,
  MacInstallerConfig,
  OnboardingSessionSnapshot,
  SessionLogLine,
  SessionStep,
  SystemActionSnapshot,
} from "./types.js";

type MutableSession = InstallSessionSnapshot & {
  logFilePath: string;
};

type MutableGuidedSetupSession = GuidedSetupSessionSnapshot & {
  logFilePath: string;
};

type MutableSystemAction = SystemActionSnapshot;

type WorkflowLogTarget = {
  status: "pending" | "running" | "completed" | "failed";
  updatedAt: string;
  currentStepId?: string;
  steps: SessionStep[];
  logs: SessionLogLine[];
  logFilePath: string;
};

export class MacInstallerService {
  private readonly sessions = new Map<string, MutableSession>();
  private readonly guidedSetupSessions = new Map<string, MutableGuidedSetupSession>();
  private readonly onboarding: OnboardingSessionManager;
  private dockerInstallAction?: MutableSystemAction;

  constructor(private readonly config: MacInstallerConfig = {}) {
    this.onboarding = new OnboardingSessionManager(config);
  }

  async inspect() {
    return inspectMacSystem(this.config);
  }

  startInstall(channel: ReleaseChannel = "stable"): InstallSessionSnapshot {
    const session = this.createSession();
    void this.runInstall(session, channel);
    return this.snapshot(session);
  }

  getSession(sessionId: string): InstallSessionSnapshot | undefined {
    const session = this.sessions.get(sessionId);
    return session ? this.snapshot(session) : undefined;
  }

  startGuidedSetup(input: GuidedSetupInput): GuidedSetupSessionSnapshot {
    for (const session of this.guidedSetupSessions.values()) {
      if (session.status === "pending" || session.status === "running") {
        throw new Error("已有进行中的一键配置会话，请等待当前任务完成。");
      }
    }

    const session = this.createGuidedSetupSession();
    void this.runGuidedSetup(session, input);
    return this.snapshotGuidedSetup(session);
  }

  getGuidedSetup(sessionId: string): GuidedSetupSessionSnapshot | undefined {
    const session = this.guidedSetupSessions.get(sessionId);
    return session ? this.snapshotGuidedSetup(session) : undefined;
  }

  async launchOnboarding(): Promise<LaunchOnboardingResult> {
    const paths = getInstallerPaths(this.config.home);
    const result = await launchOnboardingInTerminal(paths);

    return {
      launched: true,
      onboardScriptPath: result.onboardScriptPath,
      doctorScriptPath: result.doctorScriptPath,
    };
  }

  async launchDoctor(): Promise<LaunchDoctorResult> {
    const paths = getInstallerPaths(this.config.home);
    const result = await launchDoctorInTerminal(paths);

    return {
      launched: true,
      doctorScriptPath: result.doctorScriptPath,
    };
  }

  async launchDashboard(locale?: string): Promise<LaunchDashboardResult> {
    const paths = getInstallerPaths(this.config.home);
    const result = await launchDashboardInBrowser(paths, locale);

    return {
      launched: true,
      dashboardUrl: result.dashboardUrl,
    };
  }

  async startEmbeddedOnboarding(): Promise<OnboardingSessionSnapshot> {
    return this.onboarding.start();
  }

  getEmbeddedOnboarding(sessionId: string): OnboardingSessionSnapshot | undefined {
    return this.onboarding.get(sessionId);
  }

  sendEmbeddedOnboardingInput(sessionId: string, input: string): OnboardingSessionSnapshot {
    return this.onboarding.sendInput(sessionId, input);
  }

  stopEmbeddedOnboarding(sessionId: string): OnboardingSessionSnapshot {
    return this.onboarding.stop(sessionId);
  }

  async performAction(action: string): Promise<{ ok: true; message: string }> {
    switch (action) {
      case "privacy-security":
        await this.openPrivacyAndSecurity();
        return {
          ok: true,
          message: "已打开系统设置中的“隐私与安全”。",
        };
      case "docker-install":
        return this.installOrOpenDockerDesktop();
      case "docker-open":
        await this.openDockerDesktop();
        return {
          ok: true,
          message: "Docker Desktop 已打开。",
        };
      default:
        throw new Error("UNKNOWN_ACTION");
    }
  }

  startDockerInstallAction(): SystemActionSnapshot {
    if (
      this.dockerInstallAction &&
      (this.dockerInstallAction.status === "pending" ||
        this.dockerInstallAction.status === "running")
    ) {
      return { ...this.dockerInstallAction };
    }

    const now = new Date().toISOString();
    this.dockerInstallAction = {
      id: randomUUID(),
      kind: "system-action",
      action: "docker-install",
      status: "pending",
      startedAt: now,
      updatedAt: now,
      message: "正在准备 Docker Desktop 安装。",
    };

    void this.runDockerInstallAction(this.dockerInstallAction);
    return { ...this.dockerInstallAction };
  }

  getDockerInstallAction(): SystemActionSnapshot | undefined {
    return this.dockerInstallAction ? { ...this.dockerInstallAction } : undefined;
  }

  async openFolder(kind: "home" | "logs"): Promise<{ path: string }> {
    const paths = getInstallerPaths(this.config.home);
    const targetPath = kind === "logs" ? paths.logsRoot : paths.home;
    await runCommandChecked("open", [targetPath]);
    return { path: targetPath };
  }

  private createSession(): MutableSession {
    const now = new Date().toISOString();
    const paths = getInstallerPaths(this.config.home);
    const session: MutableSession = {
      id: randomUUID(),
      kind: "install",
      status: "pending",
      startedAt: now,
      updatedAt: now,
      steps: createDefaultSteps(),
      logs: [],
      logFilePath: path.join(paths.logsRoot, `install-${now.replaceAll(":", "-")}.log`),
    };

    this.sessions.set(session.id, session);
    return session;
  }

  private createGuidedSetupSession(): MutableGuidedSetupSession {
    const now = new Date().toISOString();
    const paths = getInstallerPaths(this.config.home);
    const session: MutableGuidedSetupSession = {
      id: randomUUID(),
      kind: "guided-setup",
      status: "pending",
      startedAt: now,
      updatedAt: now,
      steps: createGuidedSetupSteps(),
      logs: [],
      logFilePath: path.join(paths.logsRoot, `guided-setup-${now.replaceAll(":", "-")}.log`),
    };

    this.guidedSetupSessions.set(session.id, session);
    return session;
  }

  private snapshot(session: MutableSession): InstallSessionSnapshot {
    return {
      id: session.id,
      kind: session.kind,
      status: session.status,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      currentStepId: session.currentStepId,
      steps: session.steps.map((step) => ({ ...step })),
      logs: session.logs.slice(-LOG_TAIL_LIMIT),
      inspection: session.inspection,
      result: session.result,
      error: session.error,
    };
  }

  private snapshotGuidedSetup(session: MutableGuidedSetupSession): GuidedSetupSessionSnapshot {
    return {
      id: session.id,
      kind: session.kind,
      status: session.status,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      currentStepId: session.currentStepId,
      steps: session.steps.map((step) => ({ ...step })),
      logs: session.logs.slice(-LOG_TAIL_LIMIT),
      inspection: session.inspection,
      result: session.result,
      error: session.error,
    };
  }

  private async runInstall(session: MutableSession, _channel: ReleaseChannel): Promise<void> {
    const paths = getInstallerPaths(this.config.home);
    await mkdir(paths.logsRoot, { recursive: true });
    session.status = "running";
    await this.log(session, `开始执行 macOS 安装，会话 ${session.id}`);

    try {
      this.startStep(session, "inspect", "系统预检");
      const inspection = await this.inspect();
      session.inspection = inspection;
      await this.log(session, `预检完成：${inspection.osVersion} / ${inspection.arch}`);

      const blocked = inspection.checks.filter((item) => item.state === "blocked");
      if (blocked.length > 0) {
        throw new Error(`预检失败：${blocked.map((item) => item.title).join("、")}`);
      }
      this.completeStep(session, "inspect", "预检通过");

      this.startStep(session, "runtime", "下载 OneClaw Docker 安装包");
      const dockerWorkspace = await prepareDockerWorkspace(paths, (line, level = "info") => {
        void this.log(session, line, level);
      });
      this.completeStep(session, "runtime", "OneClaw Docker 安装包已就绪");

      this.startStep(session, "openclaw", "准备 OneClaw 设置入口");
      await this.log(session, `Docker image: ${dockerWorkspace.version}`);
      this.completeStep(session, "openclaw", "已生成 OneClaw 设置与验证脚本");

      this.startStep(session, "verify", "验证 OneClaw 工作区");
      await this.log(session, `OneClaw Docker workspace：${dockerWorkspace.openclawBin}`);
      this.completeStep(session, "verify", "OneClaw Docker 文件与脚本已验证");

      this.startStep(session, "finalize", "完成准备");
      session.result = {
        managedNodeVersion: session.inspection?.managedNode.version ?? "Docker CLI",
        openclawVersion: dockerWorkspace.version,
        openclawBin: dockerWorkspace.openclawBin,
        onboardScriptPath: dockerWorkspace.onboardScriptPath,
        doctorScriptPath: dockerWorkspace.doctorScriptPath,
        logsRoot: paths.logsRoot,
      };
      this.completeStep(session, "finalize", "OneClaw 安装准备完成，可直接启动官方设置。");

      session.status = "completed";
      session.updatedAt = new Date().toISOString();
      await this.log(session, "安装流程已完成。");
    } catch (error) {
      session.status = "failed";
      session.updatedAt = new Date().toISOString();
      session.error = error instanceof Error ? error.message : String(error);
      this.failActiveStep(session, session.error);
      await this.log(session, session.error, "error");
    }
  }

  private async runGuidedSetup(
    session: MutableGuidedSetupSession,
    input: GuidedSetupInput,
  ): Promise<void> {
    const paths = getInstallerPaths(this.config.home);
    await mkdir(paths.logsRoot, { recursive: true });
    session.status = "running";
    await this.logWorkflow(session, `开始执行 OneClaw 一键配置，会话 ${session.id}`);

    try {
      this.startWorkflowStep(session, "inspect", "检查当前环境");
      const inspection = await this.inspect();
      session.inspection = inspection;
      await this.logWorkflow(session, `预检完成：${inspection.osVersion} / ${inspection.arch}`);

      const blocked = inspection.checks.filter((item) => item.state === "blocked");
      if (blocked.length > 0) {
        throw new Error(`预检失败：${blocked.map((item) => item.title).join("、")}`);
      }
      this.completeWorkflowStep(session, "inspect", "环境检查通过");

      this.startWorkflowStep(session, "prepare", "确保 OneClaw Docker 工作区已就绪");
      await ensureDockerWorkspacePrepared(paths, (line, level = "info") => {
        void this.logWorkflow(session, line, level);
      });
      this.completeWorkflowStep(session, "prepare", "OneClaw Docker 工作区已就绪");

      const providerLabel = resolveProviderLabel(input.provider);
      this.startWorkflowStep(session, "configure", `写入 ${providerLabel} 配置并初始化 OneClaw`);
      const result = await runGuidedDockerSetup(paths, input, (line, level = "info") => {
        void this.logWorkflow(session, line, level);
      });
      this.completeWorkflowStep(session, "configure", `${providerLabel} 配置已写入 OneClaw`);

      this.startWorkflowStep(session, "verify", "验证 OneClaw Gateway 是否可用");
      const finalInspection = await this.inspect();
      session.inspection = finalInspection;
      if (!finalInspection.setupCompleted || !finalInspection.gatewayRunning) {
        throw new Error("OneClaw 已写入配置，但 Gateway 还没有成功就绪，请检查日志。");
      }
      this.completeWorkflowStep(session, "verify", "OneClaw Gateway 已通过基础验证");

      this.startWorkflowStep(session, "finalize", "完成一键配置");
      session.result = {
        configPath: result.configPath,
        workspacePath: result.workspacePath,
        healthUrl: result.healthUrl,
        doctorScriptPath: result.doctorScriptPath,
        logsRoot: paths.logsRoot,
      };
      this.completeWorkflowStep(session, "finalize", "OneClaw 一键配置已完成。");

      session.status = "completed";
      session.updatedAt = new Date().toISOString();
      await this.logWorkflow(session, "一键配置流程已完成。");
    } catch (error) {
      session.status = "failed";
      session.updatedAt = new Date().toISOString();
      session.error = error instanceof Error ? error.message : String(error);
      this.failWorkflowStep(session, session.error);
      await this.logWorkflow(session, session.error, "error");
    }
  }

  private startStep(session: MutableSession, stepId: string, title: string): void {
    this.startWorkflowStep(session, stepId, title);
  }

  private startWorkflowStep(session: WorkflowLogTarget, stepId: string, title: string): void {
    session.currentStepId = stepId;
    session.updatedAt = new Date().toISOString();
    const step = session.steps.find((item) => item.id === stepId);

    if (step) {
      step.status = "running";
      step.startedAt = session.updatedAt;
      step.detail = title;
    }
  }

  private completeStep(session: MutableSession, stepId: string, detail: string): void {
    this.completeWorkflowStep(session, stepId, detail);
  }

  private completeWorkflowStep(session: WorkflowLogTarget, stepId: string, detail: string): void {
    const step = session.steps.find((item) => item.id === stepId);
    session.updatedAt = new Date().toISOString();

    if (step) {
      step.status = "completed";
      step.completedAt = session.updatedAt;
      step.detail = detail;
    }
  }

  private failActiveStep(session: MutableSession, detail: string): void {
    this.failWorkflowStep(session, detail);
  }

  private failWorkflowStep(session: WorkflowLogTarget, detail: string): void {
    if (!session.currentStepId) {
      return;
    }

    const step = session.steps.find((item) => item.id === session.currentStepId);
    if (step) {
      step.status = "failed";
      step.completedAt = new Date().toISOString();
      step.detail = detail;
    }
  }

  private async log(
    session: MutableSession,
    message: string,
    level: "info" | "error" = "info",
  ): Promise<void> {
    await this.logWorkflow(session, message, level);
  }

  private async logWorkflow(
    session: WorkflowLogTarget,
    message: string,
    level: "info" | "error" = "info",
  ): Promise<void> {
    const line: SessionLogLine = {
      at: new Date().toISOString(),
      level,
      message,
    };
    session.logs.push(line);
    session.logs = session.logs.slice(-LOG_TAIL_LIMIT);
    session.updatedAt = line.at;
    await appendFile(session.logFilePath, `[${line.at}] [${level}] ${message}\n`);
  }

  private async openPrivacyAndSecurity(): Promise<void> {
    try {
      await runCommandChecked("open", [
        "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension",
      ]);
      return;
    } catch {
      // Fall back to the generic app launch below.
    }

    await runCommandChecked("open", ["-a", "System Settings"]);
  }

  private async runDockerInstallAction(action: MutableSystemAction): Promise<void> {
    const existingDocker = await resolveDockerAppPath();
    if (existingDocker) {
      action.status = "completed";
      action.updatedAt = new Date().toISOString();
      action.message = "Docker Desktop 已存在，已经帮你打开。";
      await this.openDockerDesktop(existingDocker);
      return;
    }

    const paths = getInstallerPaths(this.config.home);
    const downloadsRoot = paths.downloadsRoot;
    const dmgPath = path.join(downloadsRoot, `docker-desktop-${process.arch}.dmg`);
    const mountPoint = path.join(downloadsRoot, "docker-installer-mount");
    const dockerUrl = process.arch === "arm64" ? DOCKER_DESKTOP_ARM64_URL : DOCKER_DESKTOP_X64_URL;
    const username = os.userInfo().username;
    const installBinary = path.join(mountPoint, "Docker.app", "Contents", "MacOS", "install");
    const installCommand = `${shellQuote(installBinary)} --accept-license --user=${shellQuote(username)}`;
    const totalBytes = await resolveRemoteContentLength(dockerUrl);

    action.status = "running";
    action.updatedAt = new Date().toISOString();
    action.message = "正在下载 Docker Desktop。";
    action.totalBytes = totalBytes ?? undefined;

    await mkdir(downloadsRoot, { recursive: true });
    await rm(mountPoint, { recursive: true, force: true });

    try {
      await downloadFileWithProgress(dockerUrl, dmgPath, (downloadedBytes) => {
        action.updatedAt = new Date().toISOString();
        action.downloadedBytes = downloadedBytes;
        action.totalBytes = totalBytes ?? undefined;
        action.progressPercent = totalBytes
          ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
          : undefined;
        action.message = totalBytes
          ? `正在下载 Docker Desktop（${action.progressPercent ?? 0}%）`
          : `正在下载 Docker Desktop（已下载 ${formatBytes(downloadedBytes)}）`;
      });

      action.updatedAt = new Date().toISOString();
      action.message = "正在挂载 Docker 安装器。";
      await runCommandChecked("hdiutil", [
        "attach",
        dmgPath,
        "-nobrowse",
        "-mountpoint",
        mountPoint,
      ]);

      action.updatedAt = new Date().toISOString();
      action.message = "等待管理员授权安装 Docker Desktop。";
      await runCommandChecked("osascript", [
        "-e",
        `do shell script ${appleScriptString(installCommand)} with administrator privileges`,
      ]);

      action.updatedAt = new Date().toISOString();
      action.message = "正在打开 Docker Desktop。";
      await this.openDockerDesktop();

      action.status = "completed";
      action.updatedAt = new Date().toISOString();
      action.progressPercent = 100;
      action.message = "Docker Desktop 已安装并打开。等待它完成启动后，请点击“重新检查”。";
    } catch (error) {
      action.status = "failed";
      action.updatedAt = new Date().toISOString();
      action.error = error instanceof Error ? error.message : String(error);
      action.message = action.error;
    } finally {
      await runCommandChecked("hdiutil", ["detach", mountPoint]).catch(() => undefined);
      await rm(mountPoint, { recursive: true, force: true });
      await rm(dmgPath, { force: true });
    }
  }

  private async installOrOpenDockerDesktop(): Promise<{ ok: true; message: string }> {
    const existingDocker = await resolveDockerAppPath();
    if (existingDocker) {
      await this.openDockerDesktop(existingDocker);
      return {
        ok: true,
        message: "Docker Desktop 已存在，已经帮你打开。",
      };
    }

    const paths = getInstallerPaths(this.config.home);
    const downloadsRoot = paths.downloadsRoot;
    const dmgPath = path.join(downloadsRoot, `docker-desktop-${process.arch}.dmg`);
    const mountPoint = path.join(downloadsRoot, "docker-installer-mount");
    const dockerUrl = process.arch === "arm64" ? DOCKER_DESKTOP_ARM64_URL : DOCKER_DESKTOP_X64_URL;
    const username = os.userInfo().username;
    const installBinary = path.join(mountPoint, "Docker.app", "Contents", "MacOS", "install");
    const installCommand = `${shellQuote(installBinary)} --accept-license --user=${shellQuote(username)}`;

    await mkdir(downloadsRoot, { recursive: true });
    await rm(mountPoint, { recursive: true, force: true });

    try {
      await runCommandLogged(
        "curl",
        ["--location", "--fail", "--silent", "--show-error", dockerUrl, "--output", dmgPath],
        {},
      );
      await runCommandChecked("hdiutil", [
        "attach",
        dmgPath,
        "-nobrowse",
        "-mountpoint",
        mountPoint,
      ]);
      await runCommandChecked("osascript", [
        "-e",
        `do shell script ${appleScriptString(installCommand)} with administrator privileges`,
      ]);
      await this.openDockerDesktop();

      return {
        ok: true,
        message: "Docker Desktop 已安装并打开。等待它完成启动后，请点击“重新检查”。",
      };
    } finally {
      await runCommandChecked("hdiutil", ["detach", mountPoint]).catch(() => undefined);
      await rm(mountPoint, { recursive: true, force: true });
      await rm(dmgPath, { force: true });
    }
  }

  private async openDockerDesktop(dockerAppPath?: string): Promise<void> {
    const resolvedPath = dockerAppPath ?? (await resolveDockerAppPath());

    if (!resolvedPath) {
      throw new Error("未检测到 Docker Desktop，请先点击一键安装。");
    }

    await runCommandChecked("open", [resolvedPath]);
  }
}

async function resolveDockerAppPath(): Promise<string | null> {
  const candidates = [
    "/Applications/Docker.app",
    path.join(os.homedir(), "Applications", "Docker.app"),
  ];

  for (const candidate of candidates) {
    try {
      await mkdir(path.dirname(candidate), { recursive: true });
    } catch {
      // Ignore parent directory creation failures on system-owned locations.
    }

    try {
      await runCommandChecked("test", ["-d", candidate]);
      return candidate;
    } catch {
      // Continue checking other locations.
    }
  }

  return null;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function appleScriptString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function resolveRemoteContentLength(url: string): Promise<number | null> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
    });
    const raw = response.headers.get("content-length");
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

async function downloadFileWithProgress(
  url: string,
  destination: string,
  onProgress: (downloadedBytes: number) => void,
): Promise<void> {
  await rm(destination, { force: true });

  const child = spawn("curl", [
    "--location",
    "--fail",
    "--silent",
    "--show-error",
    url,
    "--output",
    destination,
  ]);

  let stderr = "";
  const poll = setInterval(() => {
    void stat(destination)
      .then((info) => onProgress(info.size))
      .catch(() => undefined);
  }, 900);

  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  await new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      clearInterval(poll);
      void stat(destination)
        .then((info) => onProgress(info.size))
        .catch(() => undefined)
        .finally(() => {
          if ((code ?? 0) === 0) {
            resolve();
            return;
          }

          reject(new Error(stderr.trim() || `curl exited with code ${code ?? -1}`));
        });
    });
  });
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }

  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function createDefaultSteps(): SessionStep[] {
  return [
    { id: "inspect", title: "系统预检", status: "pending" },
    { id: "runtime", title: "下载 OneClaw Docker 安装包", status: "pending" },
    { id: "openclaw", title: "准备 OneClaw 设置入口", status: "pending" },
    { id: "verify", title: "验证 OneClaw 工作区", status: "pending" },
    { id: "finalize", title: "生成入口脚本", status: "pending" },
  ];
}

function createGuidedSetupSteps(): SessionStep[] {
  return [
    { id: "inspect", title: "系统预检", status: "pending" },
    { id: "prepare", title: "准备 OneClaw Docker 工作区", status: "pending" },
    { id: "configure", title: "写入模型配置", status: "pending" },
    { id: "verify", title: "验证 OneClaw Gateway", status: "pending" },
    { id: "finalize", title: "完成一键配置", status: "pending" },
  ];
}

function resolveProviderLabel(provider: GuidedProvider): string {
  switch (provider) {
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Claude";
    case "yutoapi":
    default:
      return "YutoAPI";
  }
}
