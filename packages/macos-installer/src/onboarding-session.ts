import { randomUUID } from "node:crypto";
import path from "node:path";
import { TERMINAL_OUTPUT_LIMIT } from "./constants.js";
import { getEmbeddedDockerSetupCommand } from "./openclaw.js";
import { getInstallerPaths } from "./paths.js";
import type { MacInstallerConfig, OnboardingSessionSnapshot } from "./types.js";
import { pathExists } from "./utils.js";

type OnboardingPty = {
  write(data: string): void;
  kill(): void;
  onData(listener: (data: string) => void): void;
  onExit(listener: (event: { exitCode: number; signal?: number }) => void): void;
};

type MutableOnboardingSession = OnboardingSessionSnapshot & {
  process?: OnboardingPty;
  stopRequested?: boolean;
  stopTimer?: NodeJS.Timeout;
};

export class OnboardingSessionManager {
  private readonly sessions = new Map<string, MutableOnboardingSession>();

  constructor(private readonly config: MacInstallerConfig = {}) {}

  async start(): Promise<OnboardingSessionSnapshot> {
    const activeSession = Array.from(this.sessions.values()).find(
      (session) =>
        (session.status === "pending" || session.status === "running") && session.process,
    );

    if (activeSession) {
      throw new Error("已有进行中的 onboarding 会话，请先完成或停止当前会话。");
    }

    const paths = getInstallerPaths(this.config.home);
    const setupScriptPath = path.join(paths.applicationsRoot, "OneClaw Docker Setup.command");

    if (!(await pathExists(setupScriptPath))) {
      throw new Error("未检测到 Docker 设置脚本，可先执行安装准备。");
    }

    const now = new Date().toISOString();
    const session: MutableOnboardingSession = {
      id: randomUUID(),
      kind: "onboarding",
      status: "pending",
      startedAt: now,
      updatedAt: now,
      output: "",
    };

    const pty = await import("@lydell/node-pty");
    const command = getEmbeddedDockerSetupCommand(paths);
    const child = pty.spawn(command.file, command.args, {
      cwd: command.cwd,
      env: command.env,
      name: "xterm-256color",
      cols: 100,
      rows: 28,
    });

    session.process = child;
    session.status = "running";
    this.sessions.set(session.id, session);

    const append = (chunk: Buffer | string): void => {
      const text = String(chunk);
      session.output = `${session.output}${text}`.slice(-TERMINAL_OUTPUT_LIMIT);
      session.updatedAt = new Date().toISOString();
    };

    child.onData((data) => {
      append(data);
    });
    child.onExit(({ exitCode, signal }) => {
      if (session.stopTimer) {
        clearTimeout(session.stopTimer);
        delete session.stopTimer;
      }

      session.exitCode = exitCode;
      session.status = session.stopRequested
        ? "cancelled"
        : exitCode === 0
          ? "completed"
          : "failed";
      session.updatedAt = new Date().toISOString();
      session.exitedAt = session.updatedAt;
      if (session.stopRequested) {
        delete session.error;
      } else if (exitCode !== 0) {
        session.error = `docker-setup 进程退出，code=${exitCode}${signal ? ` signal=${signal}` : ""}`;
      }
      delete session.stopRequested;
      delete session.process;
    });

    return this.snapshot(session);
  }

  get(sessionId: string): OnboardingSessionSnapshot | undefined {
    const session = this.sessions.get(sessionId);
    return session ? this.snapshot(session) : undefined;
  }

  list(): OnboardingSessionSnapshot[] {
    return Array.from(this.sessions.values()).map((session) => this.snapshot(session));
  }

  sendInput(sessionId: string, input: string): OnboardingSessionSnapshot {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("ONBOARDING_SESSION_NOT_FOUND");
    }

    if (!session.process || session.status !== "running") {
      throw new Error("ONBOARDING_SESSION_NOT_RUNNING");
    }

    session.process.write(input);
    session.updatedAt = new Date().toISOString();
    return this.snapshot(session);
  }

  stop(sessionId: string): OnboardingSessionSnapshot {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("ONBOARDING_SESSION_NOT_FOUND");
    }

    if (session.process && session.status === "running") {
      session.stopRequested = true;
      session.process.write("\u0003");
      session.updatedAt = new Date().toISOString();
      session.stopTimer = setTimeout(() => {
        if (session.process && session.status === "running") {
          session.process.kill();
        }
      }, 1500);
    }

    return this.snapshot(session);
  }

  private snapshot(session: MutableOnboardingSession): OnboardingSessionSnapshot {
    return {
      id: session.id,
      kind: session.kind,
      status: session.status,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      exitedAt: session.exitedAt,
      exitCode: session.exitCode,
      output: session.output,
      error: session.error,
    };
  }
}
