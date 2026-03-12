import os from "node:os";
import path from "node:path";
import { DEFAULT_NODE_VERSION, NODE_DIST_BASE_URL, OPENCLAW_REPO_DIRNAME } from "./constants.js";
import type { MacInstallerPaths } from "./types.js";

export function getInstallerPaths(home = getInstallerHome()): MacInstallerPaths {
  return {
    home,
    runtimeRoot: path.join(home, "runtime"),
    downloadsRoot: path.join(home, "downloads"),
    packagePrefix: path.join(home, "docker-oneclaw", OPENCLAW_REPO_DIRNAME),
    logsRoot: path.join(home, "logs"),
    scriptsRoot: path.join(home, "scripts"),
    applicationsRoot: path.join(os.homedir(), "Applications", "OneClaw Installer"),
  };
}

export function getInstallerHome(): string {
  return (
    process.env.ONECLAW_INSTALLER_HOME ??
    process.env.CLAWGUI_HOME ??
    path.join(os.homedir(), "Library", "Application Support", "OneClaw Installer")
  );
}

export function getDockerConfigDir(home = getInstallerHome()): string {
  return path.join(home, "oneclaw-config");
}

export function getDockerWorkspaceDir(home = getInstallerHome()): string {
  return path.join(home, "oneclaw-workspace");
}

export function getManagedNodeDescriptor(version = DEFAULT_NODE_VERSION) {
  const platformPart = process.arch === "arm64" ? "darwin-arm64" : "darwin-x64";
  const versionWithV = version.startsWith("v") ? version : `v${version}`;
  const directoryName = `node-${versionWithV}-${platformPart}`;
  const archiveName = `${directoryName}.tar.gz`;

  return {
    version: versionWithV,
    directoryName,
    archiveName,
    archiveUrl: `${NODE_DIST_BASE_URL}/${versionWithV}/${archiveName}`,
    shasumsUrl: `${NODE_DIST_BASE_URL}/${versionWithV}/SHASUMS256.txt`,
  };
}
