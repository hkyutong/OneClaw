const KEY = "oneclaw.control.settings.v1";
const LEGACY_KEY = "openclaw.control.settings.v1";
const TOKEN_SESSION_KEY_PREFIX = "oneclaw.control.token.v1:";
const LEGACY_TOKEN_SESSION_KEY = "openclaw.control.token.v1";
const LEGACY_TOKEN_SESSION_KEY_PREFIX = "openclaw.control.token.v1:";
const SHARED_AUTH_SESSION_KEY_PREFIX = "oneclaw.control.shared-auth.v1:";

type PersistedUiSettings = Omit<UiSettings, "token"> & { token?: never };

import { isSupportedLocale } from "../i18n/index.ts";
import { inferBasePathFromPathname, normalizeBasePath } from "./navigation.ts";
import { parseThemeSelection, type ThemeMode, type ThemeName } from "./theme.ts";

export type UiSettings = {
  gatewayUrl: string;
  token: string;
  sessionKey: string;
  lastActiveSessionKey: string;
  theme: ThemeName;
  themeMode: ThemeMode;
  chatFocusMode: boolean;
  chatShowThinking: boolean;
  splitRatio: number; // Sidebar split ratio (0.4 to 0.7, default 0.6)
  navCollapsed: boolean; // Collapsible sidebar state
  navWidth: number; // Sidebar width when expanded (200–400px)
  navGroupsCollapsed: Record<string, boolean>; // Which nav groups are collapsed
  locale?: string;
};

function getSessionStorage(): Storage | null {
  if (typeof window !== "undefined" && window.sessionStorage) {
    return window.sessionStorage;
  }
  if (typeof sessionStorage !== "undefined") {
    return sessionStorage;
  }
  return null;
}

function normalizeGatewayTokenScope(gatewayUrl: string): string {
  const trimmed = gatewayUrl.trim();
  if (!trimmed) {
    return "default";
  }
  try {
    const base =
      typeof location !== "undefined"
        ? `${location.protocol}//${location.host}${location.pathname || "/"}`
        : undefined;
    const parsed = base ? new URL(trimmed, base) : new URL(trimmed);
    const pathname =
      parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "") || parsed.pathname;
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    return trimmed;
  }
}

function tokenSessionKeyForGateway(gatewayUrl: string): string {
  return `${TOKEN_SESSION_KEY_PREFIX}${normalizeGatewayTokenScope(gatewayUrl)}`;
}

function legacyTokenSessionKeyForGateway(gatewayUrl: string): string {
  return `${LEGACY_TOKEN_SESSION_KEY_PREFIX}${normalizeGatewayTokenScope(gatewayUrl)}`;
}

function sharedAuthSessionKeyForGateway(gatewayUrl: string): string {
  return `${SHARED_AUTH_SESSION_KEY_PREFIX}${normalizeGatewayTokenScope(gatewayUrl)}`;
}

function loadSessionToken(gatewayUrl: string): string {
  try {
    const storage = getSessionStorage();
    if (!storage) {
      return "";
    }
    const key = tokenSessionKeyForGateway(gatewayUrl);
    const legacyKey = legacyTokenSessionKeyForGateway(gatewayUrl);
    const token = storage.getItem(key) ?? storage.getItem(legacyKey) ?? "";
    storage.removeItem(LEGACY_TOKEN_SESSION_KEY);
    if (!storage.getItem(key) && token.trim()) {
      storage.setItem(key, token.trim());
    }
    storage.removeItem(legacyKey);
    return token.trim();
  } catch {
    return "";
  }
}

function persistSessionToken(gatewayUrl: string, token: string) {
  try {
    const storage = getSessionStorage();
    if (!storage) {
      return;
    }
    storage.removeItem(LEGACY_TOKEN_SESSION_KEY);
    const key = tokenSessionKeyForGateway(gatewayUrl);
    const legacyKey = legacyTokenSessionKeyForGateway(gatewayUrl);
    const normalized = token.trim();
    if (normalized) {
      storage.setItem(key, normalized);
      storage.removeItem(legacyKey);
      return;
    }
    storage.removeItem(key);
    storage.removeItem(legacyKey);
  } catch {
    // best-effort
  }
}

export function loadSessionSharedAuthPreference(gatewayUrl: string): boolean {
  try {
    const storage = getSessionStorage();
    if (!storage) {
      return false;
    }
    return storage.getItem(sharedAuthSessionKeyForGateway(gatewayUrl)) === "1";
  } catch {
    return false;
  }
}

export function persistSessionSharedAuthPreference(gatewayUrl: string, enabled: boolean) {
  try {
    const storage = getSessionStorage();
    if (!storage) {
      return;
    }
    const key = sharedAuthSessionKeyForGateway(gatewayUrl);
    if (enabled) {
      storage.setItem(key, "1");
      return;
    }
    storage.removeItem(key);
  } catch {
    // best-effort
  }
}

export function loadSettings(): UiSettings {
  const defaultUrl = (() => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const configured =
      typeof window !== "undefined" &&
      typeof window.__OPENCLAW_CONTROL_UI_BASE_PATH__ === "string" &&
      window.__OPENCLAW_CONTROL_UI_BASE_PATH__.trim();
    const basePath = configured
      ? normalizeBasePath(configured)
      : inferBasePathFromPathname(location.pathname);
    return `${proto}://${location.host}${basePath}`;
  })();

  const defaults: UiSettings = {
    gatewayUrl: defaultUrl,
    token: loadSessionToken(defaultUrl),
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
  };

  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<UiSettings>;
    const loadedFromLegacy =
      localStorage.getItem(KEY) == null && localStorage.getItem(LEGACY_KEY) != null;
    const { theme, mode } = parseThemeSelection(
      (parsed as { theme?: unknown }).theme,
      (parsed as { themeMode?: unknown }).themeMode,
    );
    const settings = {
      gatewayUrl:
        typeof parsed.gatewayUrl === "string" && parsed.gatewayUrl.trim()
          ? parsed.gatewayUrl.trim()
          : defaults.gatewayUrl,
      // Gateway auth is intentionally in-memory only; scrub any legacy persisted token on load.
      token: loadSessionToken(
        typeof parsed.gatewayUrl === "string" && parsed.gatewayUrl.trim()
          ? parsed.gatewayUrl.trim()
          : defaults.gatewayUrl,
      ),
      sessionKey:
        typeof parsed.sessionKey === "string" && parsed.sessionKey.trim()
          ? parsed.sessionKey.trim()
          : defaults.sessionKey,
      lastActiveSessionKey:
        typeof parsed.lastActiveSessionKey === "string" && parsed.lastActiveSessionKey.trim()
          ? parsed.lastActiveSessionKey.trim()
          : (typeof parsed.sessionKey === "string" && parsed.sessionKey.trim()) ||
            defaults.lastActiveSessionKey,
      theme,
      themeMode: mode,
      chatFocusMode:
        typeof parsed.chatFocusMode === "boolean" ? parsed.chatFocusMode : defaults.chatFocusMode,
      chatShowThinking:
        typeof parsed.chatShowThinking === "boolean"
          ? parsed.chatShowThinking
          : defaults.chatShowThinking,
      splitRatio:
        typeof parsed.splitRatio === "number" &&
        parsed.splitRatio >= 0.4 &&
        parsed.splitRatio <= 0.7
          ? parsed.splitRatio
          : defaults.splitRatio,
      navCollapsed:
        typeof parsed.navCollapsed === "boolean" ? parsed.navCollapsed : defaults.navCollapsed,
      navWidth:
        typeof parsed.navWidth === "number" && parsed.navWidth >= 200 && parsed.navWidth <= 400
          ? parsed.navWidth
          : defaults.navWidth,
      navGroupsCollapsed:
        typeof parsed.navGroupsCollapsed === "object" && parsed.navGroupsCollapsed !== null
          ? parsed.navGroupsCollapsed
          : defaults.navGroupsCollapsed,
      locale: isSupportedLocale(parsed.locale) ? parsed.locale : undefined,
    };
    if ("token" in parsed || loadedFromLegacy) {
      persistSettings(settings);
    }
    return settings;
  } catch {
    return defaults;
  }
}

export function saveSettings(next: UiSettings) {
  persistSettings(next);
}

function persistSettings(next: UiSettings) {
  persistSessionToken(next.gatewayUrl, next.token);
  const persisted: PersistedUiSettings = {
    gatewayUrl: next.gatewayUrl,
    sessionKey: next.sessionKey,
    lastActiveSessionKey: next.lastActiveSessionKey,
    theme: next.theme,
    themeMode: next.themeMode,
    chatFocusMode: next.chatFocusMode,
    chatShowThinking: next.chatShowThinking,
    splitRatio: next.splitRatio,
    navCollapsed: next.navCollapsed,
    navWidth: next.navWidth,
    navGroupsCollapsed: next.navGroupsCollapsed,
    ...(next.locale ? { locale: next.locale } : {}),
  };
  localStorage.setItem(KEY, JSON.stringify(persisted));
  localStorage.removeItem(LEGACY_KEY);
}
