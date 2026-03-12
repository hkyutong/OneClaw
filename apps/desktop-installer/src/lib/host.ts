import type { DesktopPlatform } from "@oneclaw/installer-core";

export interface DesktopHostContext {
  shell: "browser" | "electron";
  platform: NodeJS.Platform | "unknown";
  backendOrigin: string | null;
  capabilities: {
    embeddedOnboarding: boolean;
  };
}

const browserHost: DesktopHostContext = {
  shell: "browser",
  platform: "unknown",
  backendOrigin: null,
  capabilities: {
    embeddedOnboarding: true
  }
};

export function getDesktopHostContext(): DesktopHostContext {
  return window.oneclawInstallerHost ?? window["clawguiHost"] ?? browserHost;
}

export function getResolvedDesktopPlatform(): DesktopPlatform | null {
  const platform = getDesktopHostContext().platform;

  switch (platform) {
    case "darwin":
      return "macos";
    case "linux":
      return "linux";
    case "win32":
      return "windows";
    default:
      return null;
  }
}
