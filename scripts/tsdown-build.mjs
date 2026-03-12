#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const logLevel = process.env.OPENCLAW_BUILD_VERBOSE ? "info" : "warn";
const pnpmExec = process.env.npm_execpath?.includes("pnpm") ? process.env.npm_execpath : "corepack";
const pnpmArgs =
  pnpmExec === "corepack"
    ? ["pnpm", "exec", "tsdown", "--config-loader", "unrun", "--logLevel", logLevel]
    : ["exec", "tsdown", "--config-loader", "unrun", "--logLevel", logLevel];
const result = spawnSync(pnpmExec, pnpmArgs, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);
