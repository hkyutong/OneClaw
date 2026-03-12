#!/usr/bin/env node
import { startMacInstallerServer } from "./server.js";
import { MacInstallerService } from "./service.js";

async function main(): Promise<void> {
  const [command = "serve", ...args] = process.argv.slice(2);

  switch (command) {
    case "serve": {
      const port = readPortArg(args);
      const server = await startMacInstallerServer({ port });
      console.log(`OneClaw Installer macOS backend listening on http://127.0.0.1:${server.port}`);
      break;
    }
    case "inspect": {
      const service = new MacInstallerService();
      console.log(JSON.stringify(await service.inspect(), null, 2));
      break;
    }
    case "install": {
      const service = new MacInstallerService();
      const session = service.startInstall("stable");
      console.log(`Started session ${session.id}`);
      let printedLogs = 0;

      await new Promise<void>((resolve) => {
        const timer = setInterval(() => {
          const snapshot = service.getSession(session.id);
          if (!snapshot) {
            clearInterval(timer);
            resolve();
            return;
          }

          const nextLogs = snapshot.logs.slice(printedLogs);
          for (const logLine of nextLogs) {
            console.log(`[${logLine.level}] ${logLine.message}`);
          }
          printedLogs = snapshot.logs.length;

          if (snapshot.status === "completed" || snapshot.status === "failed") {
            clearInterval(timer);
            console.log(JSON.stringify(snapshot, null, 2));
            resolve();
          }
        }, 1000);
      });
      break;
    }
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function readPortArg(args: string[]): number | undefined {
  const index = args.findIndex((item) => item === "--port");
  if (index === -1) {
    return undefined;
  }

  const value = Number(args[index + 1]);
  return Number.isFinite(value) ? value : undefined;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
