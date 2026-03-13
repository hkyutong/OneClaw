

interface Window {
  oneclawInstallerHost?: {
    shell: "browser" | "electron";
    platform: NodeJS.Platform;
    backendOrigin: string | null;
    capabilities: {
      embeddedOnboarding: boolean;
    };
  };
  clawguiHost?: {
    shell: "browser" | "electron";
    platform: NodeJS.Platform;
    backendOrigin: string | null;
    capabilities: {
      embeddedOnboarding: boolean;
    };
  };
}
