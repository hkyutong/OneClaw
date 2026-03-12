import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readFile, rm, statfs, symlink, writeFile } from "node:fs/promises";

export function normalizeVersion(version: string): string {
  return version.startsWith("v") ? version.slice(1) : version;
}

export function compareVersions(left: string, right: string): number {
  const a = normalizeVersion(left).split(".").map(Number);
  const b = normalizeVersion(right).split(".").map(Number);
  const max = Math.max(a.length, b.length);

  for (let index = 0; index < max; index += 1) {
    const av = a[index] ?? 0;
    const bv = b[index] ?? 0;

    if (av > bv) {
      return 1;
    }

    if (av < bv) {
      return -1;
    }
  }

  return 0;
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(target: string): Promise<void> {
  await mkdir(target, { recursive: true });
}

export async function replaceSymlink(target: string, linkPath: string): Promise<void> {
  await rm(linkPath, { force: true, recursive: true });
  await symlink(target, linkPath);
}

export async function sha256File(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

export async function writeExecutableFile(target: string, content: string): Promise<void> {
  await writeFile(target, content, { mode: 0o755 });
}

export async function getDiskFreeBytes(target: string): Promise<number> {
  const stats = await statfs(target);
  return Number(stats.bavail) * Number(stats.bsize);
}
