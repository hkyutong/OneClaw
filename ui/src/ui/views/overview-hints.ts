import { ConnectErrorDetailCodes } from "../../../../src/gateway/protocol/connect-error-details.js";
import { t } from "../../i18n/index.ts";

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
