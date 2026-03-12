import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

const EXTRA_PATH_ENTRIES = ["/opt/homebrew/bin", "/usr/local/bin"];

export function getAugmentedEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const pathEntries = [
    ...(env.PATH ?? "").split(path.delimiter).filter(Boolean),
    ...EXTRA_PATH_ENTRIES,
  ];
  const deduped = Array.from(new Set(pathEntries));

  return {
    ...process.env,
    ...env,
    PATH: deduped.join(path.delimiter),
  };
}

export async function resolveCommandPath(
  file: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  if (file.includes("/")) {
    return file;
  }

  const pathEntries = (getAugmentedEnv(env).PATH ?? "").split(path.delimiter).filter(Boolean);

  for (const entry of pathEntries) {
    const candidate = path.join(entry, file);

    try {
      await access(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // Continue probing other entries.
    }
  }

  return file;
}

export async function runCommand(
  file: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<ExecResult> {
  const env = getAugmentedEnv(options.env);
  const executable = await resolveCommandPath(file, env);

  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (code: number | null) => {
      resolve({
        stdout,
        stderr,
        code: code ?? 0,
      });
    });
  });
}

export async function runCommandChecked(
  file: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<ExecResult> {
  const result = await runCommand(file, args, options);

  if (result.code !== 0) {
    const details = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join("\n");
    throw new Error(details || `${file} ${args.join(" ")} exited with code ${result.code}`);
  }

  return result;
}

export async function runCommandLogged(
  file: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    onLine?: (line: string, level: "info" | "error") => void;
    classifyLine?: (line: string, level: "info" | "error") => "info" | "error" | "ignore";
  } = {},
): Promise<void> {
  const env = getAugmentedEnv(options.env);
  const executable = await resolveCommandPath(file, env);

  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const emit = (chunk: Buffer | string, level: "info" | "error") => {
      const text = String(chunk)
        .split(/\r?\n/)
        .map((line) => line.trimEnd());

      for (const line of text) {
        if (line) {
          const resolvedLevel = options.classifyLine?.(line, level) ?? level;
          if (resolvedLevel !== "ignore") {
            options.onLine?.(line, resolvedLevel);
          }
        }
      }
    };

    child.stdout.on("data", (chunk) => emit(chunk, "info"));
    child.stderr.on("data", (chunk) => emit(chunk, "error"));
    child.on("error", reject);
    child.on("close", (code: number | null) => {
      if ((code ?? 0) === 0) {
        resolve();
        return;
      }

      reject(new Error(`${executable} ${args.join(" ")} exited with code ${code ?? -1}`));
    });
  });
}
