import fs from "node:fs";
import { intro as clackIntro, outro as clackOutro } from "@clack/prompts";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../agents/defaults.js";
import { loadModelCatalog } from "../agents/model-catalog.js";
import {
  getModelRefStatus,
  resolveConfiguredModelRef,
  resolveHooksGmailModel,
} from "../agents/model-selection.js";
import { formatCliCommand } from "../cli/command-format.js";
import type { OpenClawConfig } from "../config/config.js";
import { CONFIG_PATH, readConfigFileSnapshot, writeConfigFile } from "../config/config.js";
import { logConfigUpdated } from "../config/logging.js";
import { resolveSecretInputRef } from "../config/types.secrets.js";
import { resolveGatewayService } from "../daemon/service.js";
import { hasAmbiguousGatewayAuthModeConfig } from "../gateway/auth-mode-policy.js";
import { resolveGatewayAuth } from "../gateway/auth.js";
import { buildGatewayConnectionDetails } from "../gateway/call.js";
import { resolveOpenClawPackageRoot } from "../infra/openclaw-root.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { note } from "../terminal/note.js";
import { stylePromptTitle } from "../terminal/prompt-style.js";
import { shortenHomePath } from "../utils.js";
import {
  maybeRemoveDeprecatedCliAuthProfiles,
  maybeRepairAnthropicOAuthProfileId,
  noteAuthProfileHealth,
} from "./doctor-auth.js";
import { noteBootstrapFileSize } from "./doctor-bootstrap-size.js";
import { noteChromeMcpBrowserReadiness } from "./doctor-browser.js";
import { doctorShellCompletion } from "./doctor-completion.js";
import { loadAndMaybeMigrateDoctorConfig } from "./doctor-config-flow.js";
import { maybeRepairLegacyCronStore } from "./doctor-cron.js";
import { maybeRepairGatewayDaemon } from "./doctor-gateway-daemon-flow.js";
import { checkGatewayHealth, probeGatewayMemoryStatus } from "./doctor-gateway-health.js";
import {
  maybeRepairGatewayServiceConfig,
  maybeScanExtraGatewayServices,
} from "./doctor-gateway-services.js";
import { noteSourceInstallIssues } from "./doctor-install.js";
import { noteMemorySearchHealth } from "./doctor-memory-search.js";
import {
  noteMacLaunchAgentOverrides,
  noteMacLaunchctlGatewayEnvOverrides,
  noteDeprecatedLegacyEnvVars,
  noteStartupOptimizationHints,
} from "./doctor-platform-notes.js";
import { createDoctorPrompter, type DoctorOptions } from "./doctor-prompter.js";
import { maybeRepairSandboxImages, noteSandboxScopeWarnings } from "./doctor-sandbox.js";
import { noteSecurityWarnings } from "./doctor-security.js";
import { noteSessionLockHealth } from "./doctor-session-locks.js";
import { noteStateIntegrity, noteWorkspaceBackupTip } from "./doctor-state-integrity.js";
import {
  detectLegacyStateMigrations,
  runLegacyStateMigrations,
} from "./doctor-state-migrations.js";
import { maybeRepairUiProtocolFreshness } from "./doctor-ui.js";
import { maybeOfferUpdateBeforeDoctor } from "./doctor-update.js";
import { noteWorkspaceStatus } from "./doctor-workspace-status.js";
import { MEMORY_SYSTEM_PROMPT, shouldSuggestMemorySystem } from "./doctor-workspace.js";
import { noteOpenAIOAuthTlsPrerequisites } from "./oauth-tls-preflight.js";
import { applyWizardMetadata, printWizardHeader, randomToken } from "./onboard-helpers.js";
import { ensureSystemdUserLingerInteractive } from "./systemd-linger.js";

const intro = (message: string) => clackIntro(stylePromptTitle(message) ?? message);
const outro = (message: string) => clackOutro(stylePromptTitle(message) ?? message);

function resolveMode(cfg: OpenClawConfig): "local" | "remote" {
  return cfg.gateway?.mode === "remote" ? "remote" : "local";
}

export async function doctorCommand(
  runtime: RuntimeEnv = defaultRuntime,
  options: DoctorOptions = {},
) {
  const prompter = createDoctorPrompter({ runtime, options });
  printWizardHeader(runtime);
  intro("OneClaw Doctor");

  const root = await resolveOpenClawPackageRoot({
    moduleUrl: import.meta.url,
    argv1: process.argv[1],
    cwd: process.cwd(),
  });

  const updateResult = await maybeOfferUpdateBeforeDoctor({
    runtime,
    options,
    root,
    confirm: (p) => prompter.confirm(p),
    outro,
  });
  if (updateResult.handled) {
    return;
  }

  await maybeRepairUiProtocolFreshness(runtime, prompter);
  noteSourceInstallIssues(root);
  noteDeprecatedLegacyEnvVars();
  noteStartupOptimizationHints();

  const configResult = await loadAndMaybeMigrateDoctorConfig({
    options,
    confirm: (p) => prompter.confirm(p),
  });
  let cfg: OpenClawConfig = configResult.cfg;
  const cfgForPersistence = structuredClone(cfg);
  const sourceConfigValid = configResult.sourceConfigValid ?? true;

  const configPath = configResult.path ?? CONFIG_PATH;
  if (!cfg.gateway?.mode) {
    const lines = [
      "gateway.mode 尚未设置，Gateway 将无法启动。",
      `修复方法：执行 ${formatCliCommand("oneclaw configure")} 并设置 Gateway 模式（local/remote）。`,
      `或直接执行：${formatCliCommand("oneclaw config set gateway.mode local")}`,
    ];
    if (!fs.existsSync(configPath)) {
      lines.push(`尚未找到配置文件：请先执行 ${formatCliCommand("oneclaw setup")}。`);
    }
    note(lines.join("\n"), "Gateway");
  }
  if (resolveMode(cfg) === "local" && hasAmbiguousGatewayAuthModeConfig(cfg)) {
    note(
      [
        "gateway.auth.token 和 gateway.auth.password 同时存在，但 gateway.auth.mode 尚未设置。",
        "请明确指定一种认证模式，避免启动和运行时出现歧义。",
        `设置 token 模式：${formatCliCommand("oneclaw config set gateway.auth.mode token")}`,
        `设置 password 模式：${formatCliCommand("oneclaw config set gateway.auth.mode password")}`,
      ].join("\n"),
      "Gateway 认证",
    );
  }

  cfg = await maybeRepairAnthropicOAuthProfileId(cfg, prompter);
  cfg = await maybeRemoveDeprecatedCliAuthProfiles(cfg, prompter);
  await noteAuthProfileHealth({
    cfg,
    prompter,
    allowKeychainPrompt: options.nonInteractive !== true && Boolean(process.stdin.isTTY),
  });
  const gatewayDetails = buildGatewayConnectionDetails({ config: cfg });
  if (gatewayDetails.remoteFallbackNote) {
    note(gatewayDetails.remoteFallbackNote, "Gateway");
  }
  if (resolveMode(cfg) === "local" && sourceConfigValid) {
    const gatewayTokenRef = resolveSecretInputRef({
      value: cfg.gateway?.auth?.token,
      defaults: cfg.secrets?.defaults,
    }).ref;
    const auth = resolveGatewayAuth({
      authConfig: cfg.gateway?.auth,
      tailscaleMode: cfg.gateway?.tailscale?.mode ?? "off",
    });
    const needsToken = auth.mode !== "password" && (auth.mode !== "token" || !auth.token);
    if (needsToken) {
      if (gatewayTokenRef) {
        note(
          [
            "Gateway token 当前由 SecretRef 管理，但暂时不可用。",
            "Doctor 不会把 gateway.auth.token 覆盖成明文。",
            "请先修复或轮换外部密钥来源，再重新执行 Doctor。",
          ].join("\n"),
          "Gateway 认证",
        );
      } else {
        note(
          "Gateway 认证当前关闭，或缺少 token。现在推荐默认启用 token 认证（包括 loopback）。",
          "Gateway 认证",
        );
        const shouldSetToken =
          options.generateGatewayToken === true
            ? true
            : options.nonInteractive === true
              ? false
              : await prompter.confirmRepair({
                  message: "现在生成并配置一个 Gateway token 吗？",
                  initialValue: true,
                });
        if (shouldSetToken) {
          const nextToken = randomToken();
          cfg = {
            ...cfg,
            gateway: {
              ...cfg.gateway,
              auth: {
                ...cfg.gateway?.auth,
                mode: "token",
                token: nextToken,
              },
            },
          };
          note("Gateway token 已配置。", "Gateway 认证");
        }
      }
    }
  }

  const legacyState = await detectLegacyStateMigrations({ cfg });
  if (legacyState.preview.length > 0) {
    note(legacyState.preview.join("\n"), "检测到旧版状态");
    const migrate =
      options.nonInteractive === true
        ? true
        : await prompter.confirm({
            message: "现在迁移旧版状态（会话 / agent / WhatsApp 认证）吗？",
            initialValue: true,
          });
    if (migrate) {
      const migrated = await runLegacyStateMigrations({
        detected: legacyState,
      });
      if (migrated.changes.length > 0) {
        note(migrated.changes.join("\n"), "Doctor 变更");
      }
      if (migrated.warnings.length > 0) {
        note(migrated.warnings.join("\n"), "Doctor 警告");
      }
    }
  }

  await noteStateIntegrity(cfg, prompter, configResult.path ?? CONFIG_PATH);
  await noteSessionLockHealth({ shouldRepair: prompter.shouldRepair });
  await maybeRepairLegacyCronStore({
    cfg,
    options,
    prompter,
  });

  cfg = await maybeRepairSandboxImages(cfg, runtime, prompter);
  noteSandboxScopeWarnings(cfg);

  await maybeScanExtraGatewayServices(options, runtime, prompter);
  await maybeRepairGatewayServiceConfig(cfg, resolveMode(cfg), runtime, prompter);
  await noteMacLaunchAgentOverrides();
  await noteMacLaunchctlGatewayEnvOverrides(cfg);

  await noteSecurityWarnings(cfg);
  await noteChromeMcpBrowserReadiness(cfg);
  await noteOpenAIOAuthTlsPrerequisites({
    cfg,
    deep: options.deep === true,
  });

  if (cfg.hooks?.gmail?.model?.trim()) {
    const hooksModelRef = resolveHooksGmailModel({
      cfg,
      defaultProvider: DEFAULT_PROVIDER,
    });
    if (!hooksModelRef) {
      note(`- hooks.gmail.model "${cfg.hooks.gmail.model}" 无法解析`, "Hooks");
    } else {
      const { provider: defaultProvider, model: defaultModel } = resolveConfiguredModelRef({
        cfg,
        defaultProvider: DEFAULT_PROVIDER,
        defaultModel: DEFAULT_MODEL,
      });
      const catalog = await loadModelCatalog({ config: cfg });
      const status = getModelRefStatus({
        cfg,
        catalog,
        ref: hooksModelRef,
        defaultProvider,
        defaultModel,
      });
      const warnings: string[] = [];
      if (!status.allowed) {
        warnings.push(
          `- hooks.gmail.model "${status.key}" 不在 agents.defaults.models allowlist 中（将回退到主模型）`,
        );
      }
      if (!status.inCatalog) {
        warnings.push(`- hooks.gmail.model "${status.key}" 不在模型目录中（运行时可能失败）`);
      }
      if (warnings.length > 0) {
        note(warnings.join("\n"), "Hooks");
      }
    }
  }

  if (
    options.nonInteractive !== true &&
    process.platform === "linux" &&
    resolveMode(cfg) === "local"
  ) {
    const service = resolveGatewayService();
    let loaded = false;
    try {
      loaded = await service.isLoaded({ env: process.env });
    } catch {
      loaded = false;
    }
    if (loaded) {
      await ensureSystemdUserLingerInteractive({
        runtime,
        prompter: {
          confirm: async (p) => prompter.confirm(p),
          note,
        },
        reason:
          "Gateway 以 systemd 用户服务运行。如果没有开启 lingering，用户登出或会话空闲时 systemd 会停止用户会话并杀掉 Gateway。",
        requireConfirm: true,
      });
    }
  }

  noteWorkspaceStatus(cfg);
  await noteBootstrapFileSize(cfg);

  // Check and fix shell completion
  await doctorShellCompletion(runtime, prompter, {
    nonInteractive: options.nonInteractive,
  });

  const { healthOk } = await checkGatewayHealth({
    runtime,
    cfg,
    timeoutMs: options.nonInteractive === true ? 3000 : 10_000,
  });
  const gatewayMemoryProbe = healthOk
    ? await probeGatewayMemoryStatus({
        cfg,
        timeoutMs: options.nonInteractive === true ? 3000 : 10_000,
      })
    : { checked: false, ready: false };
  await noteMemorySearchHealth(cfg, { gatewayMemoryProbe });
  await maybeRepairGatewayDaemon({
    cfg,
    runtime,
    prompter,
    options,
    gatewayDetailsMessage: gatewayDetails.message,
    healthOk,
  });

  const shouldWriteConfig =
    configResult.shouldWriteConfig || JSON.stringify(cfg) !== JSON.stringify(cfgForPersistence);
  if (shouldWriteConfig) {
    cfg = applyWizardMetadata(cfg, { command: "doctor", mode: resolveMode(cfg) });
    await writeConfigFile(cfg);
    logConfigUpdated(runtime);
    const backupPath = `${CONFIG_PATH}.bak`;
    if (fs.existsSync(backupPath)) {
      runtime.log(`备份文件：${shortenHomePath(backupPath)}`);
    }
  } else if (!prompter.shouldRepair) {
    runtime.log(`如需自动应用修复，请执行 "${formatCliCommand("oneclaw doctor --fix")}"。`);
  }

  if (options.workspaceSuggestions !== false) {
    const workspaceDir = resolveAgentWorkspaceDir(cfg, resolveDefaultAgentId(cfg));
    noteWorkspaceBackupTip(workspaceDir);
    if (await shouldSuggestMemorySystem(workspaceDir)) {
      note(MEMORY_SYSTEM_PROMPT, "Workspace");
    }
  }

  const finalSnapshot = await readConfigFileSnapshot();
  if (finalSnapshot.exists && !finalSnapshot.valid) {
    runtime.error("配置无效：");
    for (const issue of finalSnapshot.issues) {
      const path = issue.path || "<root>";
      runtime.error(`- ${path}: ${issue.message}`);
    }
  }

  outro("Doctor 已完成。");
}
