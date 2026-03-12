import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { DEFAULT_NODE_VERSION } from "./constants.js";
import { getManagedNodeDescriptor } from "./paths.js";
import { runCommandLogged } from "./shell.js";
import type { MacInstallerPaths } from "./types.js";
import { ensureDir, pathExists, replaceSymlink, sha256File } from "./utils.js";

export interface RuntimeResult {
  version: string;
  installDir: string;
  nodePath: string;
  npmPath: string;
}

export async function ensureManagedNodeRuntime(
  paths: MacInstallerPaths,
  onLog: (line: string, level?: "info" | "error") => void,
  version = DEFAULT_NODE_VERSION,
): Promise<RuntimeResult> {
  const descriptor = getManagedNodeDescriptor(version);
  const installDir = path.join(paths.runtimeRoot, descriptor.directoryName);
  const nodePath = path.join(installDir, "bin", "node");
  const npmPath = path.join(installDir, "bin", "npm");

  await ensureDir(paths.runtimeRoot);
  await ensureDir(paths.downloadsRoot);

  if (await pathExists(nodePath)) {
    onLog(`复用已安装的托管 Node ${descriptor.version}。`);
    return {
      version: descriptor.version,
      installDir,
      nodePath,
      npmPath,
    };
  }

  const archivePath = path.join(paths.downloadsRoot, descriptor.archiveName);
  const expectedSha = await resolveNodeArchiveSha(descriptor.shasumsUrl, descriptor.archiveName);

  if (!(await pathExists(archivePath))) {
    onLog(`开始下载 ${descriptor.archiveUrl}`);
    await downloadFile(descriptor.archiveUrl, archivePath, onLog);
  } else {
    onLog(`检测到本地缓存 ${archivePath}`);
  }

  let actualSha = await sha256File(archivePath);
  if (actualSha !== expectedSha) {
    onLog("Node 归档缓存校验失败，删除后重新下载。", "error");
    await rm(archivePath, { force: true });
    await downloadFile(descriptor.archiveUrl, archivePath, onLog);
    actualSha = await sha256File(archivePath);
  }

  if (actualSha !== expectedSha) {
    throw new Error(`Node 归档校验失败，期望 ${expectedSha}，实际 ${actualSha}`);
  }

  onLog("Node 归档校验通过，开始解压。");
  await runCommandLogged("tar", ["-xzf", archivePath, "-C", paths.runtimeRoot], {
    onLine: (line, level) => onLog(line, level),
  });

  if (!(await pathExists(nodePath))) {
    throw new Error(`解压后未找到 node 可执行文件：${nodePath}`);
  }

  await replaceSymlink(installDir, path.join(paths.runtimeRoot, "current"));

  return {
    version: descriptor.version,
    installDir,
    nodePath,
    npmPath,
  };
}

async function resolveNodeArchiveSha(shasumsUrl: string, archiveName: string): Promise<string> {
  const response = await fetch(shasumsUrl);
  if (!response.ok) {
    throw new Error(`无法获取 Node 校验文件：${shasumsUrl}`);
  }

  const body = await response.text();
  const line = body
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item.endsWith(`  ${archiveName}`));

  if (!line) {
    throw new Error(`未在 SHASUMS256.txt 中找到 ${archiveName}`);
  }

  return line.split(/\s+/)[0];
}

async function downloadFile(
  url: string,
  targetPath: string,
  onLog: (line: string, level?: "info" | "error") => void,
): Promise<void> {
  if (process.platform === "darwin") {
    onLog("使用系统 curl 下载 Node 运行时。");
    await runCommandLogged(
      "curl",
      ["-L", "--fail", "--silent", "--show-error", "--output", targetPath, url],
      {
        onLine: (line, level) => onLog(line, level),
      },
    );
    onLog(`下载完成：${targetPath}`);
    return;
  }

  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`下载失败：${url}`);
  }

  const total = Number(response.headers.get("content-length") ?? 0);
  const file = createWriteStream(targetPath);
  const stream = Readable.fromWeb(response.body as unknown as WebReadableStream);
  let written = 0;
  let lastLoggedMb = -1;

  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => {
      written += chunk.length;
      const writtenMb = Math.floor(written / 1024 / 1024);

      if (writtenMb !== lastLoggedMb && writtenMb % 5 === 0) {
        lastLoggedMb = writtenMb;
        if (total > 0) {
          onLog(`已下载 ${writtenMb} MiB / ${(total / 1024 / 1024).toFixed(1)} MiB`);
        } else {
          onLog(`已下载 ${writtenMb} MiB`);
        }
      }
    });

    stream.on("error", reject);
    file.on("error", reject);
    file.on("finish", resolve);
    stream.pipe(file);
  });
}
