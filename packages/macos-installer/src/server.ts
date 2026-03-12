import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { DEFAULT_MAC_API_PORT } from "./constants.js";
import { MacInstallerService } from "./service.js";
import type { MacInstallerConfig } from "./types.js";

export async function startMacInstallerServer(config: MacInstallerConfig = {}): Promise<{
  port: number;
  close: () => Promise<void>;
}> {
  const service = new MacInstallerService(config);
  const port = config.port ?? DEFAULT_MAC_API_PORT;

  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
      setCorsHeaders(response);

      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }

      if (request.method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/macos/inspect") {
        sendJson(response, 200, await service.inspect());
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/macos/install") {
        const body = await readJsonBody(request);
        const channel =
          body?.channel === "beta" || body?.channel === "dev" ? body.channel : "stable";
        sendJson(response, 202, service.startInstall(channel));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/macos/oneclaw/setup") {
        const body = await readJsonBody(request);
        const provider =
          body?.provider === "openai" || body?.provider === "anthropic" ? body.provider : "yutoapi";
        const apiKey = typeof body?.apiKey === "string" ? body.apiKey : "";
        const modelId = typeof body?.modelId === "string" ? body.modelId : "";
        sendJson(response, 202, service.startGuidedSetup({ provider, apiKey, modelId }));
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/macos/sessions/")) {
        const sessionId = url.pathname.split("/").at(-1) ?? "";
        const session = service.getSession(sessionId);

        if (!session) {
          sendJson(response, 404, { error: "SESSION_NOT_FOUND" });
          return;
        }

        sendJson(response, 200, session);
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/macos/oneclaw/setup/")) {
        const sessionId = url.pathname.split("/").at(-1) ?? "";
        const session = service.getGuidedSetup(sessionId);

        if (!session) {
          sendJson(response, 404, { error: "GUIDED_SETUP_SESSION_NOT_FOUND" });
          return;
        }

        sendJson(response, 200, session);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/macos/onboard") {
        sendJson(response, 200, await service.launchOnboarding());
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/macos/doctor") {
        sendJson(response, 200, await service.launchDoctor());
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/macos/dashboard") {
        const body = await readJsonBody(request);
        const locale = typeof body?.locale === "string" ? body.locale : undefined;
        sendJson(response, 200, await service.launchDashboard(locale));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/macos/onboard/session") {
        sendJson(response, 200, await service.startEmbeddedOnboarding());
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/macos/onboard/session/")) {
        const sessionId = url.pathname.split("/").at(-1) ?? "";
        const session = service.getEmbeddedOnboarding(sessionId);

        if (!session) {
          sendJson(response, 404, { error: "ONBOARDING_SESSION_NOT_FOUND" });
          return;
        }

        sendJson(response, 200, session);
        return;
      }

      if (
        request.method === "POST" &&
        url.pathname.startsWith("/api/macos/onboard/session/") &&
        url.pathname.endsWith("/input")
      ) {
        const parts = url.pathname.split("/");
        const sessionId = parts.at(-2) ?? "";
        const body = await readJsonBody(request);
        const input = typeof body?.input === "string" ? body.input : "";
        sendJson(response, 200, service.sendEmbeddedOnboardingInput(sessionId, input));
        return;
      }

      if (
        request.method === "POST" &&
        url.pathname.startsWith("/api/macos/onboard/session/") &&
        url.pathname.endsWith("/stop")
      ) {
        const parts = url.pathname.split("/");
        const sessionId = parts.at(-2) ?? "";
        sendJson(response, 200, service.stopEmbeddedOnboarding(sessionId));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/macos/open/logs") {
        sendJson(response, 200, await service.openFolder("logs"));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/macos/open/home") {
        sendJson(response, 200, await service.openFolder("home"));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/macos/actions/docker-install/start") {
        sendJson(response, 202, service.startDockerInstallAction());
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/macos/actions/docker-install") {
        const action = service.getDockerInstallAction();
        if (!action) {
          sendJson(response, 404, { error: "ACTION_NOT_FOUND" });
          return;
        }

        sendJson(response, 200, action);
        return;
      }

      if (request.method === "POST" && url.pathname.startsWith("/api/macos/actions/")) {
        const action = url.pathname.split("/").at(-1) ?? "";
        sendJson(response, 200, await service.performAction(action));
        return;
      }

      sendJson(response, 404, { error: "NOT_FOUND" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(response, resolveErrorStatus(message), { error: message });
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve());
  });

  return {
    port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error?: Error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  };
}

function setCorsHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function readJsonBody(
  request: IncomingMessage,
): Promise<Record<string, unknown> | undefined> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function resolveErrorStatus(message: string): number {
  switch (message) {
    case "SESSION_NOT_FOUND":
    case "ONBOARDING_SESSION_NOT_FOUND":
    case "ACTION_NOT_FOUND":
    case "GUIDED_SETUP_SESSION_NOT_FOUND":
      return 404;
    case "ONBOARDING_SESSION_NOT_RUNNING":
      return 409;
    case "UNKNOWN_ACTION":
      return 400;
    default:
      break;
  }

  if (
    message.includes("已有进行中的 onboarding 会话") ||
    message.includes("已有进行中的一键配置会话") ||
    message.includes("未检测到已安装的 OneClaw")
  ) {
    return 409;
  }

  return 500;
}
