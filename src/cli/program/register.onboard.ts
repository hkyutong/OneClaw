import type { Command } from "commander";
import { formatAuthChoiceChoicesForCli } from "../../commands/auth-choice-options.js";
import type { GatewayDaemonRuntime } from "../../commands/daemon-runtime.js";
import { CORE_ONBOARD_AUTH_FLAGS } from "../../commands/onboard-core-auth-flags.js";
import type {
  AuthChoice,
  GatewayAuthChoice,
  GatewayBind,
  NodeManagerChoice,
  ResetScope,
  SecretInputMode,
  TailscaleMode,
} from "../../commands/onboard-types.js";
import { setupWizardCommand } from "../../commands/onboard.js";
import { resolveManifestProviderOnboardAuthFlags } from "../../plugins/provider-auth-choices.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";

function resolveInstallDaemonFlag(
  command: unknown,
  opts: { installDaemon?: boolean },
): boolean | undefined {
  if (!command || typeof command !== "object") {
    return undefined;
  }
  const getOptionValueSource =
    "getOptionValueSource" in command ? command.getOptionValueSource : undefined;
  if (typeof getOptionValueSource !== "function") {
    return undefined;
  }

  // Commander doesn't support option conflicts natively; keep original behavior.
  // If --skip-daemon is explicitly passed, it wins.
  if (getOptionValueSource.call(command, "skipDaemon") === "cli") {
    return false;
  }
  if (getOptionValueSource.call(command, "installDaemon") === "cli") {
    return Boolean(opts.installDaemon);
  }
  return undefined;
}

const AUTH_CHOICE_HELP = formatAuthChoiceChoicesForCli({
  includeLegacyAliases: true,
  includeSkip: true,
});

const ONBOARD_AUTH_FLAGS = [
  ...CORE_ONBOARD_AUTH_FLAGS,
  ...resolveManifestProviderOnboardAuthFlags(),
] as const;

function pickOnboardProviderAuthOptionValues(
  opts: Record<string, unknown>,
): Partial<Record<string, string | undefined>> {
  return Object.fromEntries(
    ONBOARD_AUTH_FLAGS.map((flag) => [flag.optionKey, opts[flag.optionKey] as string | undefined]),
  );
}

export function registerOnboardCommand(program: Command) {
  const command = program
    .command("onboard")
    .description("交互式向导：设置网关、工作区与技能")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档：")} ${formatDocsLink("/cli/onboard", "docs.openclaw.ai/cli/onboard")}\n`,
    )
    .option("--workspace <dir>", "Agent 工作区目录（默认：~/.oneclaw/workspace）")
    .option("--reset", "运行向导前重置配置、凭据与会话（工作区仅在 --reset-scope full 时重置）")
    .option("--reset-scope <scope>", "重置范围：config|config+creds+sessions|full")
    .option("--non-interactive", "无提示运行", false)
    .option(
      "--accept-risk",
      "确认已理解 Agent 的能力和系统访问风险（--non-interactive 必需）",
      false,
    )
    .option("--flow <flow>", "向导流程：quickstart|advanced|manual")
    .option("--mode <mode>", "向导模式：local|remote")
    .option("--auth-choice <choice>", `认证方式：${AUTH_CHOICE_HELP}`)
    .option("--token-provider <id>", "Token 提供商 ID（无交互模式；配合 --auth-choice token 使用）")
    .option("--token <token>", "Token 值（无交互模式；配合 --auth-choice token 使用）")
    .option("--token-profile-id <id>", "认证配置 ID（无交互模式；默认：<provider>:manual）")
    .option("--token-expires-in <duration>", "可选的 token 过期时间（例如 365d、12h）")
    .option("--secret-input-mode <mode>", "API Key 保存方式：plaintext|ref（默认：plaintext）")
    .option("--cloudflare-ai-gateway-account-id <id>", "Cloudflare Account ID")
    .option("--cloudflare-ai-gateway-gateway-id <id>", "Cloudflare AI Gateway ID");

  for (const providerFlag of ONBOARD_AUTH_FLAGS) {
    command.option(providerFlag.cliOption, providerFlag.description);
  }

  command
    .option("--custom-base-url <url>", "自定义提供商 Base URL")
    .option("--custom-api-key <key>", "自定义提供商 API Key（可选）")
    .option("--custom-model-id <id>", "自定义提供商模型 ID")
    .option("--custom-provider-id <id>", "自定义提供商 ID（可选；默认自动推断）")
    .option(
      "--custom-compatibility <mode>",
      "自定义提供商 API 兼容模式：openai|anthropic（默认：openai）",
    )
    .option("--gateway-port <port>", "Gateway 端口")
    .option("--gateway-bind <mode>", "Gateway 绑定方式：loopback|tailnet|lan|auto|custom")
    .option("--gateway-auth <mode>", "Gateway 认证方式：token|password")
    .option("--gateway-token <token>", "Gateway token（token 认证）")
    .option(
      "--gateway-token-ref-env <name>",
      "Gateway token 的 SecretRef 环境变量名（token 认证，例如 OPENCLAW_GATEWAY_TOKEN）",
    )
    .option("--gateway-password <password>", "Gateway 密码（password 认证）")
    .option("--remote-url <url>", "远程 Gateway 的 WebSocket URL")
    .option("--remote-token <token>", "远程 Gateway token（可选）")
    .option("--tailscale <mode>", "Tailscale：off|serve|funnel")
    .option("--tailscale-reset-on-exit", "退出时重置 Tailscale serve/funnel")
    .option("--install-daemon", "安装 Gateway 服务")
    .option("--no-install-daemon", "跳过 Gateway 服务安装")
    .option("--skip-daemon", "跳过 Gateway 服务安装")
    .option("--daemon-runtime <runtime>", "Daemon 运行时：node|bun")
    .option("--skip-channels", "跳过渠道配置")
    .option("--skip-skills", "跳过技能配置")
    .option("--skip-search", "跳过搜索配置")
    .option("--skip-health", "跳过健康检查")
    .option("--skip-ui", "跳过 Control UI/TUI 相关提示")
    .option("--node-manager <name>", "技能安装使用的 Node 管理器：npm|pnpm|bun")
    .option("--json", "输出 JSON 摘要", false);

  command.action(async (opts, commandRuntime) => {
    await runCommandWithRuntime(defaultRuntime, async () => {
      const installDaemon = resolveInstallDaemonFlag(commandRuntime, {
        installDaemon: Boolean(opts.installDaemon),
      });
      const gatewayPort =
        typeof opts.gatewayPort === "string" ? Number.parseInt(opts.gatewayPort, 10) : undefined;
      const providerAuthOptionValues = pickOnboardProviderAuthOptionValues(
        opts as Record<string, unknown>,
      );
      await setupWizardCommand(
        {
          workspace: opts.workspace as string | undefined,
          nonInteractive: Boolean(opts.nonInteractive),
          acceptRisk: Boolean(opts.acceptRisk),
          flow: opts.flow as "quickstart" | "advanced" | "manual" | undefined,
          mode: opts.mode as "local" | "remote" | undefined,
          authChoice: opts.authChoice as AuthChoice | undefined,
          tokenProvider: opts.tokenProvider as string | undefined,
          token: opts.token as string | undefined,
          tokenProfileId: opts.tokenProfileId as string | undefined,
          tokenExpiresIn: opts.tokenExpiresIn as string | undefined,
          secretInputMode: opts.secretInputMode as SecretInputMode | undefined,
          ...providerAuthOptionValues,
          cloudflareAiGatewayAccountId: opts.cloudflareAiGatewayAccountId as string | undefined,
          cloudflareAiGatewayGatewayId: opts.cloudflareAiGatewayGatewayId as string | undefined,
          customBaseUrl: opts.customBaseUrl as string | undefined,
          customApiKey: opts.customApiKey as string | undefined,
          customModelId: opts.customModelId as string | undefined,
          customProviderId: opts.customProviderId as string | undefined,
          customCompatibility: opts.customCompatibility as "openai" | "anthropic" | undefined,
          gatewayPort:
            typeof gatewayPort === "number" && Number.isFinite(gatewayPort)
              ? gatewayPort
              : undefined,
          gatewayBind: opts.gatewayBind as GatewayBind | undefined,
          gatewayAuth: opts.gatewayAuth as GatewayAuthChoice | undefined,
          gatewayToken: opts.gatewayToken as string | undefined,
          gatewayTokenRefEnv: opts.gatewayTokenRefEnv as string | undefined,
          gatewayPassword: opts.gatewayPassword as string | undefined,
          remoteUrl: opts.remoteUrl as string | undefined,
          remoteToken: opts.remoteToken as string | undefined,
          tailscale: opts.tailscale as TailscaleMode | undefined,
          tailscaleResetOnExit: Boolean(opts.tailscaleResetOnExit),
          reset: Boolean(opts.reset),
          resetScope: opts.resetScope as ResetScope | undefined,
          installDaemon,
          daemonRuntime: opts.daemonRuntime as GatewayDaemonRuntime | undefined,
          skipChannels: Boolean(opts.skipChannels),
          skipSkills: Boolean(opts.skipSkills),
          skipSearch: Boolean(opts.skipSearch),
          skipHealth: Boolean(opts.skipHealth),
          skipUi: Boolean(opts.skipUi),
          nodeManager: opts.nodeManager as NodeManagerChoice | undefined,
          json: Boolean(opts.json),
        },
        defaultRuntime,
      );
    });
  });
}
