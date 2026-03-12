const { contextBridge } = require("electron");

const backendOrigin =
  process.platform === "darwin" ? "http://127.0.0.1:4318" : null;
const embeddedOnboarding =
  process.platform === "darwin" && hasEmbeddedOnboardingBinary();

contextBridge.exposeInMainWorld("oneclawInstallerHost", {
  shell: "electron",
  platform: process.platform,
  backendOrigin,
  capabilities: {
    embeddedOnboarding
  }
});

function hasEmbeddedOnboardingBinary() {
  try {
    require.resolve(`@lydell/node-pty-${process.platform}-${process.arch}`);
    return true;
  } catch {
    return false;
  }
}
