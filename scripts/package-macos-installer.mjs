#!/usr/bin/env node

import { execFile } from "node:child_process";
import { chmod, cp, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { downloadArtifact } from "@electron/get";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const args = parseArgs(process.argv.slice(2));
const APP_BUNDLE_NAME = "OneClaw Installer.app";
const LAUNCHER_NAME = "启动 OneClaw Installer.command";
const EXECUTABLE_NAME = "OneClawInstaller";

await main();

async function main() {
  ensureSupportedArch(args.arch);

  const desktopPackage = await readJson(
    path.join(rootDir, "apps", "desktop-installer", "package.json"),
  );
  const macInstallerPackage = await readJson(
    path.join(rootDir, "packages", "macos-installer", "package.json"),
  );
  const electronVersion = desktopPackage.devDependencies.electron;
  const nodePtyVersion = macInstallerPackage.dependencies["@lydell/node-pty"];

  await verifyBuildArtifacts();

  const outputRoot = path.join(rootDir, "release", "macos", args.arch);
  const appBundlePath = path.join(outputRoot, APP_BUNDLE_NAME);
  const resourcesAppPath = path.join(appBundlePath, "Contents", "Resources", "app");
  const nodeModulesPath = path.join(resourcesAppPath, "node_modules");

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  const electronAppSource = await resolveElectronApp(electronVersion, args.arch, outputRoot);
  await execFileAsync("ditto", [electronAppSource, appBundlePath]);

  await customizeMacBundle(appBundlePath);
  await mkdir(resourcesAppPath, { recursive: true });
  await writeAppPackageJson(resourcesAppPath, desktopPackage.version);

  await cp(
    path.join(rootDir, "apps", "desktop-installer", "dist"),
    path.join(resourcesAppPath, "dist"),
    {
      recursive: true,
    },
  );
  await cp(
    path.join(rootDir, "apps", "desktop-installer", "electron"),
    path.join(resourcesAppPath, "electron"),
    { recursive: true },
  );

  await copyWorkspaceRuntimePackage("installer-core", nodeModulesPath);
  await copyWorkspaceRuntimePackage("macos-installer", nodeModulesPath);
  await copyInstalledPackage("@lydell/node-pty", nodeModulesPath);
  await ensurePlatformSpecificNodePty(nodeModulesPath, args.arch, nodePtyVersion);

  await signBundle(appBundlePath);
  await writeLauncher(outputRoot);
  await zipBundle(outputRoot, appBundlePath);
  await rm(path.join(outputRoot, ".electron"), { recursive: true, force: true });

  console.log(`${APP_BUNDLE_NAME} 已生成：${appBundlePath}`);
  console.log(`启动脚本：${path.join(outputRoot, LAUNCHER_NAME)}`);
  console.log(`压缩包：${path.join(outputRoot, `OneClaw-Installer-${args.arch}.zip`)}`);
}

function parseArgs(argv) {
  const archFlagIndex = argv.indexOf("--arch");
  if (archFlagIndex >= 0 && argv[archFlagIndex + 1]) {
    return {
      arch: argv[archFlagIndex + 1],
    };
  }

  return {
    arch: process.arch,
  };
}

function ensureSupportedArch(arch) {
  if (arch !== "arm64" && arch !== "x64") {
    throw new Error(`当前仅支持 arm64 或 x64，收到 ${arch}`);
  }
}

async function verifyBuildArtifacts() {
  const requiredPaths = [
    path.join(rootDir, "apps", "desktop-installer", "dist", "index.html"),
    path.join(rootDir, "packages", "installer-core", "dist", "index.js"),
    path.join(rootDir, "packages", "macos-installer", "dist", "index.js"),
  ];

  for (const target of requiredPaths) {
    try {
      await readFile(target);
    } catch {
      throw new Error(`缺少构建产物：${target}。请先运行 pnpm installer:build`);
    }
  }
}

async function resolveElectronApp(electronVersion, arch, outputRoot) {
  if (arch === process.arch) {
    const localElectronApp = await resolveInstalledAssetPath("electron", "dist", "Electron.app");
    if (localElectronApp) {
      return localElectronApp;
    }
  }

  const downloadPath = await downloadArtifact({
    version: electronVersion,
    artifactName: "electron",
    platform: "darwin",
    arch,
  });

  const extractRoot = path.join(outputRoot, ".electron");
  await mkdir(extractRoot, { recursive: true });
  await execFileAsync("ditto", ["-x", "-k", downloadPath, extractRoot]);
  return path.join(extractRoot, "Electron.app");
}

async function customizeMacBundle(appBundlePath) {
  const contentsPath = path.join(appBundlePath, "Contents");
  const resourcesPath = path.join(contentsPath, "Resources");
  const infoPlistPath = path.join(contentsPath, "Info.plist");
  const executablePath = path.join(contentsPath, "MacOS", "Electron");
  const renamedExecutablePath = path.join(contentsPath, "MacOS", EXECUTABLE_NAME);
  const iconSourcePath = path.join(rootDir, "yuto-macOS.icns");
  const iconTargetPath = path.join(resourcesPath, "yuto-macOS.icns");

  await rename(executablePath, renamedExecutablePath);
  await cp(iconSourcePath, iconTargetPath);

  await plistSet(infoPlistPath, "CFBundleDisplayName", "OneClaw Installer");
  await plistSet(infoPlistPath, "CFBundleName", "OneClaw Installer");
  await plistSet(infoPlistPath, "CFBundleExecutable", EXECUTABLE_NAME);
  await plistSet(infoPlistPath, "CFBundleIdentifier", "top.hkgpt.oneclaw.installer");
  await plistSet(infoPlistPath, "CFBundleVersion", "1");
  await plistSet(infoPlistPath, "CFBundleShortVersionString", "0.1.0");
  await plistSet(infoPlistPath, "CFBundleIconFile", "yuto-macOS.icns");
  await plistSet(infoPlistPath, "LSApplicationCategoryType", "public.app-category.utilities");
  await execFileAsync("xattr", ["-cr", appBundlePath]).catch(() => undefined);
}

async function plistSet(plistPath, key, value) {
  try {
    await execFileAsync("/usr/libexec/PlistBuddy", ["-c", `Set :${key} ${value}`, plistPath]);
  } catch {
    await execFileAsync("/usr/libexec/PlistBuddy", [
      "-c",
      `Add :${key} string ${value}`,
      plistPath,
    ]);
  }
}

async function writeAppPackageJson(resourcesAppPath, version) {
  const packageJson = {
    name: "oneclaw-installer",
    version,
    private: true,
    description: "macOS GUI installer for OneClaw using the Docker setup flow.",
    main: "electron/main.cjs",
  };

  await writeFile(
    path.join(resourcesAppPath, "package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );
}

async function copyWorkspaceRuntimePackage(packageName, nodeModulesPath) {
  const sourceRoot = path.join(rootDir, "packages", packageName);
  const packageJson = await readJson(path.join(sourceRoot, "package.json"));
  const targetDir = path.join(nodeModulesPath, "@oneclaw", packageName);

  await mkdir(targetDir, { recursive: true });
  await cp(path.join(sourceRoot, "dist"), path.join(targetDir, "dist"), { recursive: true });
  await writeFile(
    path.join(targetDir, "package.json"),
    `${JSON.stringify(
      {
        name: packageJson.name,
        version: packageJson.version,
        private: packageJson.private,
        type: packageJson.type,
        main: packageJson.main,
        types: packageJson.types,
        exports: packageJson.exports,
        dependencies: packageJson.dependencies,
      },
      null,
      2,
    )}\n`,
  );
}

async function copyInstalledPackage(packageName, nodeModulesPath) {
  const sourceDir = await resolveInstalledPackageDir(packageName);
  const targetDir = path.join(nodeModulesPath, ...packageName.split("/"));
  await mkdir(path.dirname(targetDir), { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true });
}

async function ensurePlatformSpecificNodePty(nodeModulesPath, arch, version) {
  const packageName = `@lydell/node-pty-darwin-${arch}`;
  const targetDir = path.join(nodeModulesPath, ...packageName.split("/"));

  await mkdir(path.dirname(targetDir), { recursive: true });

  try {
    const sourceDir = await resolveInstalledPackageDir(packageName);
    await cp(sourceDir, targetDir, { recursive: true });
    return;
  } catch {
    // Fall through to npm pack when the local machine lacks the target-arch optional package.
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "oneclaw-installer-node-pty-"));
  try {
    const { stdout } = await execFileAsync(
      "npm",
      ["pack", `${packageName}@${version}`, "--pack-destination", tempRoot],
      {
        cwd: rootDir,
      },
    );
    const tarballName = stdout.trim().split("\n").at(-1);

    if (!tarballName) {
      throw new Error(`无法下载 ${packageName}@${version}`);
    }

    await mkdir(targetDir, { recursive: true });
    await execFileAsync("tar", [
      "-xzf",
      path.join(tempRoot, tarballName),
      "-C",
      targetDir,
      "--strip-components=1",
    ]);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function signBundle(appBundlePath) {
  await execFileAsync("codesign", ["--force", "--deep", "--sign", "-", appBundlePath]);
}

async function writeLauncher(outputRoot) {
  const launcherPath = path.join(outputRoot, LAUNCHER_NAME);
  const launcherScript = [
    "#!/bin/zsh",
    "set -e",
    'SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)',
    `APP_PATH="$SCRIPT_DIR/${APP_BUNDLE_NAME}"`,
    'xattr -dr com.apple.quarantine "$APP_PATH" 2>/dev/null || true',
    'open "$APP_PATH"',
    "",
  ].join("\n");

  await writeFile(launcherPath, launcherScript);
  await chmod(launcherPath, 0o755);
}

async function zipBundle(outputRoot, appBundlePath) {
  const zipPath = path.join(outputRoot, `OneClaw-Installer-${args.arch}.zip`);
  await rm(zipPath, { force: true });
  await execFileAsync("ditto", [
    "-c",
    "-k",
    "--sequesterRsrc",
    "--keepParent",
    appBundlePath,
    zipPath,
  ]);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function resolveInstalledAssetPath(packageName, ...relativePath) {
  try {
    const packageDir = await resolveInstalledPackageDir(packageName);
    const candidate = path.join(packageDir, ...relativePath);
    await stat(candidate);
    return candidate;
  } catch {
    return null;
  }
}

async function resolveInstalledPackageDir(packageName) {
  for (const baseDir of getNodeModulesSearchRoots()) {
    const candidate = path.join(baseDir, ...packageName.split("/"));
    try {
      await readFile(path.join(candidate, "package.json"));
      return candidate;
    } catch {
      // Keep walking the known workspace node_modules locations.
    }
  }

  throw new Error(`找不到已安装依赖：${packageName}`);
}

function getNodeModulesSearchRoots() {
  return [
    path.join(rootDir, "apps", "desktop-installer", "node_modules"),
    path.join(rootDir, "node_modules"),
  ];
}
