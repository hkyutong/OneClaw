import type { ReleaseChannel } from "@oneclaw/installer-core";

export type CheckState = "ready" | "attention" | "blocked";
export type GuidedProvider = "yutoapi" | "openai" | "anthropic";

export interface MacCheck {
  id: string;
  title: string;
  state: CheckState;
  detail: string;
}

export interface VersionProbe {
  installed: boolean;
  version?: string;
  path?: string;
  satisfiesRequirement?: boolean;
}

export interface MacInstallerPaths {
  home: string;
  runtimeRoot: string;
  downloadsRoot: string;
  packagePrefix: string;
  logsRoot: string;
  scriptsRoot: string;
  applicationsRoot: string;
}

export interface MacInspection {
  checkedAt: string;
  platform: "macos";
  arch: string;
  osVersion: string;
  nodeRequirement: string;
  latestNodeVersion: string;
  latestOpenClawVersion: string;
  paths: MacInstallerPaths;
  diskFreeBytes: number;
  systemNode: VersionProbe;
  managedNode: VersionProbe;
  openclaw: VersionProbe;
  setupCompleted: boolean;
  gatewayRunning: boolean;
  checks: MacCheck[];
}

export interface SessionStep {
  id: string;
  title: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
  detail?: string;
}

export interface SessionLogLine {
  at: string;
  level: "info" | "error";
  message: string;
}

export interface InstallSessionSnapshot {
  id: string;
  kind: "install";
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string;
  updatedAt: string;
  currentStepId?: string;
  steps: SessionStep[];
  logs: SessionLogLine[];
  inspection?: MacInspection;
  result?: {
    managedNodeVersion: string;
    openclawVersion: string;
    openclawBin: string;
    onboardScriptPath: string;
    doctorScriptPath: string;
    logsRoot: string;
  };
  error?: string;
}

export interface GuidedSetupInput {
  provider: GuidedProvider;
  apiKey: string;
  modelId: string;
}

export interface GuidedSetupSessionSnapshot {
  id: string;
  kind: "guided-setup";
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string;
  updatedAt: string;
  currentStepId?: string;
  steps: SessionStep[];
  logs: SessionLogLine[];
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

export interface MacInstallerConfig {
  home?: string;
  port?: number;
}

export interface StartInstallInput {
  channel?: ReleaseChannel;
}

export interface LaunchOnboardingResult {
  launched: boolean;
  onboardScriptPath: string;
  doctorScriptPath: string;
}

export interface LaunchDoctorResult {
  launched: boolean;
  doctorScriptPath: string;
}

export interface LaunchDashboardResult {
  launched: boolean;
  dashboardUrl: string;
}

export interface OnboardingSessionSnapshot {
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

export interface SystemActionSnapshot {
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
