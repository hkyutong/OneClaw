import { beforeEach, describe, expect, it } from "vitest";
import { applySettingsFromUrl } from "./app-settings.ts";
import { loadSessionSharedAuthPreference } from "./storage.ts";

function createHost() {
  const gatewayUrl = `ws://${window.location.host}`;
  return {
    settings: {
      gatewayUrl,
      token: "",
      sessionKey: "main",
      lastActiveSessionKey: "main",
      theme: "claw",
      themeMode: "system",
      chatFocusMode: false,
      chatShowThinking: true,
      splitRatio: 0.6,
      navCollapsed: false,
      navWidth: 220,
      navGroupsCollapsed: {},
    },
    theme: "claw",
    themeMode: "system",
    themeResolved: "dark",
    applySessionKey: "main",
    sessionKey: "main",
    tab: "overview",
    connected: false,
    chatHasAutoScrolled: false,
    logsAtBottom: false,
    eventLog: [],
    eventLogBuffer: [],
    basePath: "/ui",
    themeMedia: null,
    themeMediaHandler: null,
    pendingGatewayUrl: null,
    pendingGatewayToken: null,
    pendingGatewaySharedAuth: null,
  };
}

describe("applySettingsFromUrl", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, "", "/ui/overview");
  });

  it("hydrates skipDeviceAuth from the URL and strips it after persisting session auth mode", () => {
    const host = createHost();
    window.history.replaceState({}, "", "/ui/overview#token=abc123&skipDeviceAuth=1");

    applySettingsFromUrl(host);

    expect(host.settings.token).toBe("abc123");
    expect(loadSessionSharedAuthPreference(host.settings.gatewayUrl)).toBe(true);
    expect(window.location.pathname).toBe("/ui/overview");
    expect(window.location.hash).toBe("");
  });
});
