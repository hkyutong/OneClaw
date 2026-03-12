export type DesktopPlatform = "macos" | "linux" | "windows";

export type ReleaseChannel = "stable" | "beta" | "dev";

export const OPENCLAW_NODE_MIN_VERSION = "22.12.0";

export type InstallStrategy = "native-managed-runtime" | "windows-wsl2-managed-runtime";

export type StepKind =
  | "detect-platform"
  | "preflight-checks"
  | "prepare-runtime"
  | "fetch-openclaw"
  | "install-openclaw"
  | "run-onboarding"
  | "install-daemon"
  | "verify-health"
  | "create-entrypoints"
  | "finalize";

export interface InstallSource {
  name: string;
  url: string;
  reason: string;
}

export interface InstallWarning {
  code: string;
  message: string;
}

export interface InstallStep {
  id: string;
  kind: StepKind;
  title: string;
  description: string;
  requiresElevation: boolean;
  retryable: boolean;
}

export interface PlannerInput {
  platform: DesktopPlatform;
  channel?: ReleaseChannel;
  hasWsl2?: boolean;
  hasManagedNodeRuntime?: boolean;
}

export interface InstallPlan {
  platform: DesktopPlatform;
  channel: ReleaseChannel;
  strategy: InstallStrategy;
  steps: InstallStep[];
  warnings: InstallWarning[];
  sources: InstallSource[];
}
