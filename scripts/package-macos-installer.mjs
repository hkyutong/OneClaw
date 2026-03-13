#!/usr/bin/env node

import { execFile } from "node:child_process";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
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
const GUIDE_NAME = "安装说明-本地签名版.txt";

await main();

async function main() {
  ensureSupportedArch(args.arch);

  const rootPackage = await readJson(path.join(rootDir, "package.json"));
  const desktopPackage = await readJson(
    path.join(rootDir, "apps", "desktop-installer", "package.json"),
  );
  const macInstallerPackage = await readJson(
    path.join(rootDir, "packages", "macos-installer", "package.json"),
  );
  const electronVersion = desktopPackage.devDependencies.electron;
  const nodePtyVersion = macInstallerPackage.dependencies["@lydell/node-pty"];
  const oneclawVersion = rootPackage.version;

  await verifyBuildArtifacts();

  const outputRoot = path.join(rootDir, "release", "macos", args.arch);
  const packageDir = path.join(outputRoot, "OneClaw Installer");
  const appBundlePath = path.join(packageDir, APP_BUNDLE_NAME);
  const resourcesAppPath = path.join(appBundlePath, "Contents", "Resources", "app");
  const nodeModulesPath = path.join(resourcesAppPath, "node_modules");

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(packageDir, { recursive: true });

  const electronAppSource = await resolveElectronApp(electronVersion, args.arch, outputRoot);
  await execFileAsync("ditto", [electronAppSource, appBundlePath]);

  await customizeMacBundle(appBundlePath);
  await mkdir(resourcesAppPath, { recursive: true });
  await writeAppPackageJson(resourcesAppPath, oneclawVersion);

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
  await signMacBundle(appBundlePath);

  await writeLauncher(packageDir);
  await writeInstallGuide(packageDir, oneclawVersion);
  await zipBundle(outputRoot, packageDir);
  await rm(path.join(outputRoot, ".electron"), { recursive: true, force: true });

  console.log(`${APP_BUNDLE_NAME} 已生成：${appBundlePath}`);
  console.log(`启动脚本：${path.join(packageDir, LAUNCHER_NAME)}`);
  console.log(`压缩包：${path.join(outputRoot, `OneClaw-Installer-${args.arch}.zip`)}`);
  console.log(`说明文档：${path.join(packageDir, GUIDE_NAME)}`);
  console.log(`固定安装版本：OneClaw ${oneclawVersion} (v${oneclawVersion})`);
  console.log("签名：已完成（本地 ad-hoc 签名）");
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
  const rootPackage = await readJson(path.join(rootDir, "package.json"));
  await plistSet(infoPlistPath, "CFBundleVersion", rootPackage.version);
  await plistSet(infoPlistPath, "CFBundleShortVersionString", rootPackage.version);
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

async function writeLauncher(packageDir) {
  const launcherPath = path.join(packageDir, LAUNCHER_NAME);
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

async function writeInstallGuide(packageDir, oneclawVersion) {
  const guidePath = path.join(packageDir, GUIDE_NAME);
  const content = [
    "OneClaw Installer 本地签名安装说明",
    "",
    "这是一份使用本地 ad-hoc 签名、但未公证的 macOS 安装器。",
    `它会固定下载并部署 OneClaw ${oneclawVersion}（tag: v${oneclawVersion}）。`,
    "如果 macOS 提示“无法验证开发者”或“已阻止打开”，按下面步骤操作。",
    "",
    "建议打开方式：",
    "1. 先解压 zip。",
    "2. 双击同目录里的“启动 OneClaw Installer.command”。",
    "   它会先尝试移除隔离属性，再打开安装器。",
    "",
    "如果还是被拦截：",
    "1. 在 Finder 里右键“OneClaw Installer.app”。",
    "2. 选择“打开”。",
    "3. 再次点“打开”。",
    "",
    "如果系统已经弹出“已阻止打开”：",
    "1. 打开“系统设置”。",
    "2. 进入“隐私与安全性”。",
    "3. 滚动到页面底部。",
    "4. 在 OneClaw Installer 的拦截提示旁边点“仍要打开”。",
    "5. 返回后再次打开安装器。",
    "",
    "终端兜底方案：",
    'xattr -dr com.apple.quarantine "/path/to/OneClaw Installer.app"',
    "",
    "注意：",
    "- 这不是“永久允许所有不受信任软件”，而是只放行这一个安装器。",
    "- 如果你是发给别人，建议把这份说明和 zip 一起发出去。",
    "",
  ].join("\n");

  await writeFile(guidePath, content);
}

async function signMacBundle(appBundlePath) {
  await execFileAsync("/usr/bin/codesign", [
    "--force",
    "--deep",
    "--sign",
    "-",
    "--timestamp=none",
    appBundlePath,
  ]);
  await execFileAsync("/usr/bin/codesign", [
    "--verify",
    "--deep",
    "--strict",
    "--verbose=2",
    appBundlePath,
  ]);
}

async function zipBundle(outputRoot, packageDir) {
  const zipPath = path.join(outputRoot, `OneClaw-Installer-${args.arch}.zip`);
  await rm(zipPath, { force: true });

  await execFileAsync("ditto", ["-c", "-k", "--keepParent", "--norsrc", packageDir, zipPath]);
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
      return await realpath(candidate);
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
