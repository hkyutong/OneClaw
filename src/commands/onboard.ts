import { formatCliCommand } from "../cli/command-format.js";
import { readConfigFileSnapshot } from "../config/config.js";
import { assertSupportedRuntime } from "../infra/runtime-guard.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { resolveUserPath } from "../utils.js";
import { isDeprecatedAuthChoice, normalizeLegacyOnboardAuthChoice } from "./auth-choice-legacy.js";
import { DEFAULT_WORKSPACE, handleReset } from "./onboard-helpers.js";
import { runInteractiveOnboarding } from "./onboard-interactive.js";
import { runNonInteractiveOnboarding } from "./onboard-non-interactive.js";
import type { OnboardOptions, ResetScope } from "./onboard-types.js";

const VALID_RESET_SCOPES = new Set<ResetScope>(["config", "config+creds+sessions", "full"]);

export async function onboardCommand(opts: OnboardOptions, runtime: RuntimeEnv = defaultRuntime) {
  assertSupportedRuntime(runtime);
  const originalAuthChoice = opts.authChoice;
  const normalizedAuthChoice = normalizeLegacyOnboardAuthChoice(originalAuthChoice);
  if (opts.nonInteractive && isDeprecatedAuthChoice(originalAuthChoice)) {
    runtime.error(
      [
        `认证选项 "${String(originalAuthChoice)}" 已废弃。`,
        '请改用 "--auth-choice token"（Anthropic setup-token）或 "--auth-choice openai-codex"。',
      ].join("\n"),
    );
    runtime.exit(1);
    return;
  }
  if (originalAuthChoice === "claude-cli") {
    runtime.log('认证选项 "claude-cli" 已废弃，现改用 setup-token 流程。');
  }
  if (originalAuthChoice === "codex-cli") {
    runtime.log('认证选项 "codex-cli" 已废弃，现改用 OpenAI Codex OAuth。');
  }
  const flow = opts.flow === "manual" ? ("advanced" as const) : opts.flow;
  const normalizedOpts =
    normalizedAuthChoice === opts.authChoice && flow === opts.flow
      ? opts
      : { ...opts, authChoice: normalizedAuthChoice, flow };
  if (
    normalizedOpts.secretInputMode &&
    normalizedOpts.secretInputMode !== "plaintext" && // pragma: allowlist secret
    normalizedOpts.secretInputMode !== "ref" // pragma: allowlist secret
  ) {
    runtime.error('无效的 --secret-input-mode。可用值： "plaintext" 或 "ref"。');
    runtime.exit(1);
    return;
  }

  if (normalizedOpts.resetScope && !VALID_RESET_SCOPES.has(normalizedOpts.resetScope)) {
    runtime.error('无效的 --reset-scope。可用值： "config"、"config+creds+sessions" 或 "full"。');
    runtime.exit(1);
    return;
  }

  if (normalizedOpts.nonInteractive && normalizedOpts.acceptRisk !== true) {
    runtime.error(
      [
        "无交互初始化需要显式确认风险。",
        "阅读说明：https://docs.openclaw.ai/security",
        `请重新执行：${formatCliCommand("oneclaw onboard --non-interactive --accept-risk ...")}`,
      ].join("\n"),
    );
    runtime.exit(1);
    return;
  }

  if (normalizedOpts.reset) {
    const snapshot = await readConfigFileSnapshot();
    const baseConfig = snapshot.valid ? snapshot.config : {};
    const workspaceDefault =
      normalizedOpts.workspace ?? baseConfig.agents?.defaults?.workspace ?? DEFAULT_WORKSPACE;
    const resetScope: ResetScope = normalizedOpts.resetScope ?? "config+creds+sessions";
    await handleReset(resetScope, resolveUserPath(workspaceDefault), runtime);
  }

  if (process.platform === "win32") {
    runtime.log(
      [
        "检测到 Windows。",
        "OneClaw 当前推荐通过 WSL2 运行。",
        "最快的准备方式：执行 wsl --install，然后重启一次。",
        "参考：https://docs.openclaw.ai/windows",
      ].join("\n"),
    );
  }

  if (normalizedOpts.nonInteractive) {
    await runNonInteractiveOnboarding(normalizedOpts, runtime);
    return;
  }

  await runInteractiveOnboarding(normalizedOpts, runtime);
}

export type { OnboardOptions } from "./onboard-types.js";
