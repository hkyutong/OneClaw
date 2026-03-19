import {
  credentialsMatchConfig as credentialsMatchConfigImpl,
  loadMatrixCredentials as loadMatrixCredentialsImpl,
  saveMatrixCredentials as saveMatrixCredentialsImpl,
  touchMatrixCredentials as touchMatrixCredentialsImpl,
} from "./credentials.js";

type LoadMatrixCredentials = typeof import("./credentials.js").loadMatrixCredentials;
type SaveMatrixCredentials = typeof import("./credentials.js").saveMatrixCredentials;
type CredentialsMatchConfig = typeof import("./credentials.js").credentialsMatchConfig;
type TouchMatrixCredentials = typeof import("./credentials.js").touchMatrixCredentials;

export function loadMatrixCredentials(
  ...args: Parameters<LoadMatrixCredentials>
): ReturnType<LoadMatrixCredentials> {
  return loadMatrixCredentialsImpl(...args);
}

export function saveMatrixCredentials(
  ...args: Parameters<SaveMatrixCredentials>
): ReturnType<SaveMatrixCredentials> {
  return saveMatrixCredentialsImpl(...args);
}

export function credentialsMatchConfig(
  ...args: Parameters<CredentialsMatchConfig>
): ReturnType<CredentialsMatchConfig> {
  return credentialsMatchConfigImpl(...args);
}

export function touchMatrixCredentials(
  ...args: Parameters<TouchMatrixCredentials>
): ReturnType<TouchMatrixCredentials> {
  return touchMatrixCredentialsImpl(...args);
}
