import type { ReleaseChannel } from "@oneclaw/installer-core";
import { getDesktopHostContext } from "./host.js";

export type MacCheckState = "ready" | "attention" | "blocked";
export type GuidedProvider = "yutoapi" | "openai" | "anthropic";

export interface MacCheck {
  id: string;
  title: string;
  state: MacCheckState;
  detail: string;
}

export interface MacInspection {
  checkedAt: string;
  platform: "macos";
  arch: string;
  osVersion: string;
  nodeRequirement: string;
  latestNodeVersion: string;
  latestOpenClawVersion: string;
  diskFreeBytes: number;
  setupCompleted: boolean;
  gatewayRunning: boolean;
  checks: MacCheck[];
  systemNode: {
    installed: boolean;
    version?: string;
    satisfiesRequirement?: boolean;
  };
  managedNode: {
    installed: boolean;
    version?: string;
  };
  openclaw: {
    installed: boolean;
    version?: string;
    path?: string;
  };
  paths: {
    home: string;
    logsRoot: string;
  };
}

export interface InstallSession {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  currentStepId?: string;
  steps: Array<{
    id: string;
    title: string;
    status: "pending" | "running" | "completed" | "failed";
    detail?: string;
  }>;
  logs: Array<{
    at: string;
    level: "info" | "error";
    message: string;
  }>;
  inspection?: MacInspection;
  result?: {
    managedNodeVersion: string;
    openclawVersion: string;
    onboardScriptPath: string;
    doctorScriptPath: string;
    logsRoot: string;
  };
  error?: string;
}

export interface GuidedSetupSession {
  id: string;
  kind: "guided-setup";
  status: "pending" | "running" | "completed" | "failed";
  currentStepId?: string;
  steps: Array<{
    id: string;
    title: string;
    status: "pending" | "running" | "completed" | "failed";
    detail?: string;
  }>;
  logs: Array<{
    at: string;
    level: "info" | "error";
    message: string;
  }>;
  inspection?: MacInspection;
  result?: {
    configPath: string;
    workspacePath: string;
    healthUrl: string;
    doctorScriptPath: string;
    logsRoot: string;
  };
  error?: string;
}

export interface OnboardingSession {
  id: string;
  kind: "onboarding";
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  startedAt: string;
  updatedAt: string;
  exitedAt?: string;
  exitCode?: number | null;
  output: string;
  error?: string;
}

export interface SystemAction {
  id: string;
  kind: "system-action";
  action: "docker-install";
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string;
  updatedAt: string;
  message: string;
  detail?: string;
  progressPercent?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  error?: string;
}

export async function checkMacBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(resolveApiUrl("/health"));
    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchMacInspection(): Promise<MacInspection> {
  return requestJson("/api/macos/inspect");
}

export async function startMacInstall(
  channel: ReleaseChannel
): Promise<InstallSession> {
  return requestJson("/api/macos/install", {
    method: "POST",
    body: JSON.stringify({ channel })
  });
}

export async function fetchMacSession(sessionId: string): Promise<InstallSession> {
  return requestJson(`/api/macos/sessions/${sessionId}`);
}

export async function startMacGuidedSetup(input: {
  provider: GuidedProvider;
  apiKey: string;
  modelId: string;
}): Promise<GuidedSetupSession> {
  return requestJson("/api/macos/oneclaw/setup", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function fetchMacGuidedSetup(sessionId: string): Promise<GuidedSetupSession> {
  return requestJson(`/api/macos/oneclaw/setup/${sessionId}`);
}

export async function launchMacOnboarding(): Promise<{
  launched: boolean;
  onboardScriptPath: string;
}> {
  return requestJson("/api/macos/onboard", {
    method: "POST"
  });
}

export async function launchMacDoctor(): Promise<{
  launched: boolean;
  doctorScriptPath: string;
}> {
  return requestJson("/api/macos/doctor", {
    method: "POST"
  });
}

export async function launchMacDashboard(): Promise<{
  launched: boolean;
  dashboardUrl: string;
}> {
  return requestJson("/api/macos/dashboard", {
    method: "POST"
  });
}

export async function launchMacDashboardWithLocale(locale: "zh-CN" | "en"): Promise<{
  launched: boolean;
  dashboardUrl: string;
}> {
  return requestJson("/api/macos/dashboard", {
    method: "POST",
    body: JSON.stringify({ locale })
  });
}

export async function startEmbeddedMacOnboarding(): Promise<OnboardingSession> {
  return requestJson("/api/macos/onboard/session", {
    method: "POST"
  });
}

export async function fetchEmbeddedMacOnboarding(
  sessionId: string
): Promise<OnboardingSession> {
  return requestJson(`/api/macos/onboard/session/${sessionId}`);
}

export async function sendEmbeddedMacOnboardingInput(
  sessionId: string,
  input: string
): Promise<OnboardingSession> {
  return requestJson(`/api/macos/onboard/session/${sessionId}/input`, {
    method: "POST",
    body: JSON.stringify({ input })
  });
}

export async function stopEmbeddedMacOnboarding(
  sessionId: string
): Promise<OnboardingSession> {
  return requestJson(`/api/macos/onboard/session/${sessionId}/stop`, {
    method: "POST"
  });
}

export async function openMacFolder(kind: "home" | "logs"): Promise<void> {
  await requestJson(`/api/macos/open/${kind}`, {
    method: "POST"
  });
}

export async function performMacAction(
  action: "privacy-security" | "docker-install" | "docker-open"
): Promise<{ ok: true; message: string }> {
  return requestJson(`/api/macos/actions/${action}`, {
    method: "POST"
  });
}

export async function startMacDockerInstall(): Promise<SystemAction> {
  return requestJson("/api/macos/actions/docker-install/start", {
    method: "POST"
  });
}

export async function fetchMacDockerInstall(): Promise<SystemAction> {
  return requestJson("/api/macos/actions/docker-install");
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(resolveApiUrl(input), {
    ...init,
    headers
  });

  if (!response.ok) {
    const fallback = `${response.status} ${response.statusText}`.trim();
    const bodyText = await response.text();

    try {
      const payload = JSON.parse(bodyText) as { error?: string; message?: string };
      throw new Error((payload.error ?? payload.message ?? bodyText) || fallback);
    } catch (error) {
      if (error instanceof Error && error.message !== bodyText) {
        throw error;
      }

      throw new Error(bodyText || fallback, { cause: error });
    }
  }

  return response.json() as Promise<T>;
}

function resolveApiUrl(input: string): string {
  const { backendOrigin } = getDesktopHostContext();
  return backendOrigin ? new URL(input, backendOrigin).toString() : input;
}
