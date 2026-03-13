import { runCommand } from "./shell.js";

export async function buildComposeCliRunArgs(
  repoRoot: string,
  composeEnv: NodeJS.ProcessEnv,
  cliArgs: string[],
  options: {
    serviceArgs?: string[];
  } = {},
): Promise<string[]> {
  const args = ["run", "--rm", "-T"];

  if (await isGatewayContainerRunning(repoRoot, composeEnv)) {
    args.push("--no-deps");
  }

  return [...args, ...(options.serviceArgs ?? []), "oneclaw-cli", ...cliArgs];
}

async function isGatewayContainerRunning(
  repoRoot: string,
  composeEnv: NodeJS.ProcessEnv,
): Promise<boolean> {
  const result = await runCommand("docker", ["compose", "exec", "-T", "oneclaw-gateway", "true"], {
    cwd: repoRoot,
    env: { ...process.env, ...composeEnv },
  });

  return result.code === 0;
}
