import { ConnectErrorDetailCodes } from "../../../../src/gateway/protocol/connect-error-details.js";
import { t } from "../../i18n/index.ts";

const AUTH_REQUIRED_CODES = new Set<string>([
  ConnectErrorDetailCodes.AUTH_REQUIRED,
  ConnectErrorDetailCodes.AUTH_TOKEN_MISSING,
  ConnectErrorDetailCodes.AUTH_PASSWORD_MISSING,
  ConnectErrorDetailCodes.AUTH_TOKEN_NOT_CONFIGURED,
  ConnectErrorDetailCodes.AUTH_PASSWORD_NOT_CONFIGURED,
]);

const AUTH_FAILURE_CODES = new Set<string>([
  ...AUTH_REQUIRED_CODES,
  ConnectErrorDetailCodes.AUTH_UNAUTHORIZED,
  ConnectErrorDetailCodes.AUTH_TOKEN_MISMATCH,
  ConnectErrorDetailCodes.AUTH_PASSWORD_MISMATCH,
  ConnectErrorDetailCodes.AUTH_DEVICE_TOKEN_MISMATCH,
  ConnectErrorDetailCodes.AUTH_RATE_LIMITED,
  ConnectErrorDetailCodes.AUTH_TAILSCALE_IDENTITY_MISSING,
  ConnectErrorDetailCodes.AUTH_TAILSCALE_PROXY_MISSING,
  ConnectErrorDetailCodes.AUTH_TAILSCALE_WHOIS_FAILED,
  ConnectErrorDetailCodes.AUTH_TAILSCALE_IDENTITY_MISMATCH,
]);

const INSECURE_CONTEXT_CODES = new Set<string>([
  ConnectErrorDetailCodes.CONTROL_UI_DEVICE_IDENTITY_REQUIRED,
  ConnectErrorDetailCodes.DEVICE_IDENTITY_REQUIRED,
]);

type AuthHintKind = "required" | "failed";

/** Whether the overview should show device-pairing guidance for this error. */
export function shouldShowPairingHint(
  connected: boolean,
  lastError: string | null,
  lastErrorCode?: string | null,
): boolean {
  if (connected || !lastError) {
    return false;
  }
  if (lastErrorCode === ConnectErrorDetailCodes.PAIRING_REQUIRED) {
    return true;
  }
  const lower = lastError.toLowerCase();
  return (
    lower.includes("pairing required") ||
    lower.includes("not_paired") ||
    lower.includes("not paired")
  );
}

export function localizeGatewayError(
  lastError: string | null,
  lastErrorCode?: string | null,
): string | null {
  if (!lastError) {
    return null;
  }

  if (lastErrorCode === ConnectErrorDetailCodes.PAIRING_REQUIRED) {
    return t("errors.pairingRequired");
  }
  if (
    lastErrorCode === ConnectErrorDetailCodes.AUTH_UNAUTHORIZED ||
    lastErrorCode === ConnectErrorDetailCodes.AUTH_TOKEN_MISMATCH ||
    lastErrorCode === ConnectErrorDetailCodes.AUTH_PASSWORD_MISMATCH
  ) {
    return t("errors.unauthorized");
  }
  if (
    lastErrorCode === ConnectErrorDetailCodes.CONTROL_UI_DEVICE_IDENTITY_REQUIRED ||
    lastErrorCode === ConnectErrorDetailCodes.DEVICE_IDENTITY_REQUIRED
  ) {
    return t("errors.deviceIdentityRequired");
  }

  const lower = lastError.toLowerCase();

  if (lower.includes("pairing required")) {
    return t("errors.pairingRequired");
  }
  if (lower.includes("not_paired") || lower.includes("not paired")) {
    return t("errors.pairingRequired");
  }
  if (
    lower.includes("invalid connect params") ||
    lower.includes("must be equal to constant") ||
    lower.includes("must match a schema in anyof")
  ) {
    return "控制台连接参数与当前网关协议不匹配，请刷新页面后重试。";
  }
  if (lower.includes("protocol mismatch")) {
    return "控制台与网关协议版本不匹配，请刷新页面或重新打开控制台。";
  }
  if (lower.includes("unauthorized")) {
    return t("errors.unauthorized");
  }
  if (lower.includes("control ui requires device identity")) {
    return "当前控制台需要设备身份认证，请在本机或安全上下文中重新打开。";
  }
  if (lower.includes("device identity required")) {
    return t("errors.deviceIdentityRequired");
  }
  if (lower.includes("secure context")) {
    return t("errors.secureContextRequired");
  }
  if (lower.includes("fetch failed") || lower.includes("failed to fetch")) {
    return "网络请求失败，请检查网关地址、网络连接或浏览器权限后重试。";
  }
  if (lower.includes("connect failed")) {
    return t("errors.connectFailed");
  }
  if (lower.startsWith("gateway closed")) {
    return `${t("errors.gatewayClosed")}：${lastError}`;
  }
  if (lower.includes("request failed")) {
    return t("errors.requestFailed");
  }
  if (lower === "chat error") {
    return t("errors.chatError");
  }

  return lastError;
}

/**
 * Return the overview auth hint to show, if any.
 *
 * Keep fallback string matching narrow so generic "connect failed" close reasons
 * do not get misclassified as token/password problems.
 */
export function resolveAuthHintKind(params: {
  connected: boolean;
  lastError: string | null;
  lastErrorCode?: string | null;
  hasToken: boolean;
  hasPassword: boolean;
}): AuthHintKind | null {
  if (params.connected || !params.lastError) {
    return null;
  }
  if (params.lastErrorCode) {
    if (!AUTH_FAILURE_CODES.has(params.lastErrorCode)) {
      return null;
    }
    return AUTH_REQUIRED_CODES.has(params.lastErrorCode) ? "required" : "failed";
  }

  const lower = params.lastError.toLowerCase();
  if (!lower.includes("unauthorized")) {
    return null;
  }
  return !params.hasToken && !params.hasPassword ? "required" : "failed";
}

export function shouldShowInsecureContextHint(
  connected: boolean,
  lastError: string | null,
  lastErrorCode?: string | null,
): boolean {
  if (connected || !lastError) {
    return false;
  }
  if (lastErrorCode) {
    return INSECURE_CONTEXT_CODES.has(lastErrorCode);
  }
  const lower = lastError.toLowerCase();
  return lower.includes("secure context") || lower.includes("device identity required");
}
