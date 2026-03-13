import {
  ONECLAW_INSTALL_BUNDLE_ARCHIVE_URL,
  ONECLAW_INSTALL_BUNDLE_DIRNAME,
  ONECLAW_INSTALL_BUNDLE_LABEL,
  ONECLAW_INSTALL_VERSION_SOURCE_URL,
} from "@oneclaw/installer-core";

export const DEFAULT_MAC_API_PORT = 4318;
export const DEFAULT_NODE_VERSION = "Docker Desktop";
export const DEFAULT_OPENCLAW_VERSION = ONECLAW_INSTALL_BUNDLE_LABEL;
export const NODE_DIST_BASE_URL = "https://nodejs.org/dist";
export const OPENCLAW_REGISTRY_URL = ONECLAW_INSTALL_BUNDLE_ARCHIVE_URL;
export const OPENCLAW_DOCKER_IMAGE: string = "oneclaw:local";
export const OPENCLAW_REPO_ARCHIVE_URL = ONECLAW_INSTALL_BUNDLE_ARCHIVE_URL;
export const OPENCLAW_REPO_DIRNAME = ONECLAW_INSTALL_BUNDLE_DIRNAME;
export const OPENCLAW_VERSION_SOURCE_URL = ONECLAW_INSTALL_VERSION_SOURCE_URL;
export const DEFAULT_ONECLAW_GATEWAY_PORT = 18789;
export const DEFAULT_ONECLAW_BRIDGE_PORT = 18790;
export const DEFAULT_ONECLAW_GATEWAY_BIND = "lan";
export const YUTOAPI_BASE_URL = "https://gptapi.asia/v1";
export const DEFAULT_YUTOAPI_MODEL_ID = "gpt-4o-mini";
export const DEFAULT_OPENAI_MODEL_ID = "gpt-5.1-codex";
export const DEFAULT_ANTHROPIC_MODEL_ID = "claude-sonnet-4-6";
export const DOCKER_DESKTOP_ARM64_URL = "https://desktop.docker.com/mac/main/arm64/Docker.dmg";
export const DOCKER_DESKTOP_X64_URL = "https://desktop.docker.com/mac/main/amd64/Docker.dmg";
export const LOG_TAIL_LIMIT = 240;
export const TERMINAL_OUTPUT_LIMIT = 120000;
export const MIN_FREE_DISK_BYTES = 4 * 1024 * 1024 * 1024;
