/**
 * Client-side execution engine for slash commands.
 * Calls gateway RPC methods and returns formatted results.
 */

import type { ModelCatalogEntry } from "../../../../src/agents/model-catalog.js";
import {
  formatThinkingLevels,
  normalizeThinkLevel,
  normalizeVerboseLevel,
  resolveThinkingDefaultForModel,
} from "../../../../src/auto-reply/thinking.shared.js";
import {
  DEFAULT_AGENT_ID,
  DEFAULT_MAIN_KEY,
  isSubagentSessionKey,
  parseAgentSessionKey,
} from "../../../../src/routing/session-key.js";
import { createChatModelOverride, resolveServerChatModelValue } from "../chat-model-ref.ts";
import type { GatewayBrowserClient } from "../gateway.ts";
import type {
  AgentsListResult,
  ChatModelOverride,
  GatewaySessionRow,
  SessionsListResult,
  SessionsPatchResult,
} from "../types.ts";
import { SLASH_COMMANDS } from "./slash-commands.ts";

export type SlashCommandResult = {
  /** Markdown-formatted result to display in chat. */
  content: string;
  /** Side-effect action the caller should perform after displaying the result. */
  action?:
    | "refresh"
    | "export"
    | "new-session"
    | "reset"
    | "stop"
    | "clear"
    | "toggle-focus"
    | "navigate-usage";
  /** Optional session-level directive changes that the caller should mirror locally. */
  sessionPatch?: {
    modelOverride?: ChatModelOverride | null;
  };
};

export async function executeSlashCommand(
  client: GatewayBrowserClient,
  sessionKey: string,
  commandName: string,
  args: string,
): Promise<SlashCommandResult> {
  switch (commandName) {
    case "help":
      return executeHelp();
    case "new":
      return { content: "正在开始新会话...", action: "new-session" };
    case "reset":
      return { content: "正在重置会话...", action: "reset" };
    case "stop":
      return { content: "正在停止当前运行...", action: "stop" };
    case "clear":
      return { content: "聊天记录已清空。", action: "clear" };
    case "focus":
      return { content: "已切换专注模式。", action: "toggle-focus" };
    case "compact":
      return await executeCompact(client, sessionKey);
    case "model":
      return await executeModel(client, sessionKey, args);
    case "think":
      return await executeThink(client, sessionKey, args);
    case "fast":
      return await executeFast(client, sessionKey, args);
    case "verbose":
      return await executeVerbose(client, sessionKey, args);
    case "export":
      return { content: "正在导出当前会话...", action: "export" };
    case "usage":
      return await executeUsage(client, sessionKey);
    case "agents":
      return await executeAgents(client);
    case "kill":
      return await executeKill(client, sessionKey, args);
    default:
      return { content: `未知命令：\`/${commandName}\`` };
  }
}

// ── Command Implementations ──

function executeHelp(): SlashCommandResult {
  const lines = ["**可用命令**\n"];
  let currentCategory = "";

  for (const cmd of SLASH_COMMANDS) {
    const cat = cmd.category ?? "session";
    if (cat !== currentCategory) {
      currentCategory = cat;
      lines.push(`**${CATEGORY_LABELS[cat]}**`);
    }
    const argStr = cmd.args ? ` ${cmd.args}` : "";
    const local = cmd.executeLocal ? "" : " *(由代理执行)*";
    lines.push(`\`/${cmd.name}${argStr}\` — ${cmd.description}${local}`);
  }

  lines.push("\n输入 `/` 可打开命令菜单。");
  return { content: lines.join("\n") };
}

async function executeCompact(
  client: GatewayBrowserClient,
  sessionKey: string,
): Promise<SlashCommandResult> {
  try {
    await client.request("sessions.compact", { key: sessionKey });
    return { content: "会话上下文已成功压缩。", action: "refresh" };
  } catch (err) {
    return { content: `压缩上下文失败：${String(err)}` };
  }
}

async function executeModel(
  client: GatewayBrowserClient,
  sessionKey: string,
  args: string,
): Promise<SlashCommandResult> {
  if (!args) {
    try {
      const [sessions, models] = await Promise.all([
        client.request<SessionsListResult>("sessions.list", {}),
        client.request<{ models: ModelCatalogEntry[] }>("models.list", {}),
      ]);
      const session = resolveCurrentSession(sessions, sessionKey);
      const model = session?.model || sessions?.defaults?.model || "默认";
      const available = models?.models?.map((m: ModelCatalogEntry) => m.id) ?? [];
      const lines = [`**当前模型：** \`${model}\``];
      if (available.length > 0) {
        lines.push(
          `**可用模型：** ${available
            .slice(0, 10)
            .map((m: string) => `\`${m}\``)
            .join("，")}${available.length > 10 ? ` 等另外 ${available.length - 10} 个` : ""}`,
        );
      }
      return { content: lines.join("\n") };
    } catch (err) {
      return { content: `获取模型信息失败：${String(err)}` };
    }
  }

  try {
    const patched = await client.request<SessionsPatchResult>("sessions.patch", {
      key: sessionKey,
      model: args.trim(),
    });
    const resolvedValue = resolveServerChatModelValue(
      patched.resolved?.model ?? args.trim(),
      patched.resolved?.modelProvider,
    );
    return {
      content: `Model set to \`${args.trim()}\`.`,
      action: "refresh",
      sessionPatch: { modelOverride: createChatModelOverride(resolvedValue) },
    };
  } catch (err) {
    return { content: `设置模型失败：${String(err)}` };
  }
}

async function executeThink(
  client: GatewayBrowserClient,
  sessionKey: string,
  args: string,
): Promise<SlashCommandResult> {
  const rawLevel = args.trim();

  if (!rawLevel) {
    try {
      const { session, models } = await loadThinkingCommandState(client, sessionKey);
      return {
        content: formatDirectiveOptions(
          `当前思考强度：${resolveCurrentThinkingLevel(session, models)}。`,
          formatThinkingLevels(session?.modelProvider, session?.model),
        ),
      };
    } catch (err) {
      return { content: `获取思考强度失败：${String(err)}` };
    }
  }

  const level = normalizeThinkLevel(rawLevel);
  if (!level) {
    try {
      const session = await loadCurrentSession(client, sessionKey);
      return {
        content: `无法识别思考强度“${rawLevel}”。可用级别：${formatThinkingLevels(session?.modelProvider, session?.model)}。`,
      };
    } catch (err) {
      return { content: `校验思考强度失败：${String(err)}` };
    }
  }

  try {
    await client.request("sessions.patch", { key: sessionKey, thinkingLevel: level });
    return {
      content: `思考强度已设置为 **${level}**。`,
      action: "refresh",
    };
  } catch (err) {
    return { content: `设置思考强度失败：${String(err)}` };
  }
}

async function executeVerbose(
  client: GatewayBrowserClient,
  sessionKey: string,
  args: string,
): Promise<SlashCommandResult> {
  const rawLevel = args.trim();

  if (!rawLevel) {
    try {
      const session = await loadCurrentSession(client, sessionKey);
      return {
        content: formatDirectiveOptions(
          `当前详细输出级别：${normalizeVerboseLevel(session?.verboseLevel) ?? "off"}。`,
          "on, full, off",
        ),
      };
    } catch (err) {
      return { content: `获取详细输出级别失败：${String(err)}` };
    }
  }

  const level = normalizeVerboseLevel(rawLevel);
  if (!level) {
    return {
      content: `无法识别详细输出级别“${rawLevel}”。可用级别：off、on、full。`,
    };
  }

  try {
    await client.request("sessions.patch", { key: sessionKey, verboseLevel: level });
    return {
      content: `详细输出级别已设置为 **${level}**。`,
      action: "refresh",
    };
  } catch (err) {
    return { content: `设置详细输出级别失败：${String(err)}` };
  }
}

async function executeFast(
  client: GatewayBrowserClient,
  sessionKey: string,
  args: string,
): Promise<SlashCommandResult> {
  const rawMode = args.trim().toLowerCase();

  if (!rawMode || rawMode === "status") {
    try {
      const session = await loadCurrentSession(client, sessionKey);
      return {
        content: formatDirectiveOptions(
          `Current fast mode: ${resolveCurrentFastMode(session)}.`,
          "status, on, off",
        ),
      };
    } catch (err) {
      return { content: `Failed to get fast mode: ${String(err)}` };
    }
  }

  if (rawMode !== "on" && rawMode !== "off") {
    return {
      content: `Unrecognized fast mode "${args.trim()}". Valid levels: status, on, off.`,
    };
  }

  try {
    await client.request("sessions.patch", { key: sessionKey, fastMode: rawMode === "on" });
    return {
      content: `Fast mode ${rawMode === "on" ? "enabled" : "disabled"}.`,
      action: "refresh",
    };
  } catch (err) {
    return { content: `Failed to set fast mode: ${String(err)}` };
  }
}

async function executeUsage(
  client: GatewayBrowserClient,
  sessionKey: string,
): Promise<SlashCommandResult> {
  try {
    const sessions = await client.request<SessionsListResult>("sessions.list", {});
    const session = resolveCurrentSession(sessions, sessionKey);
    if (!session) {
      return { content: "当前没有活动会话。" };
    }
    const input = session.inputTokens ?? 0;
    const output = session.outputTokens ?? 0;
    const total = session.totalTokens ?? input + output;
    const ctx = session.contextTokens ?? 0;
    const pct = ctx > 0 ? Math.round((input / ctx) * 100) : null;

    const lines = [
      "**当前会话用量**",
      `输入：**${fmtTokens(input)}** 令牌`,
      `输出：**${fmtTokens(output)}** 令牌`,
      `总计：**${fmtTokens(total)}** 令牌`,
    ];
    if (pct !== null) {
      lines.push(`上下文占用：**${pct}%** / ${fmtTokens(ctx)}`);
    }
    if (session.model) {
      lines.push(`模型：\`${session.model}\``);
    }
    return { content: lines.join("\n") };
  } catch (err) {
    return { content: `获取用量失败：${String(err)}` };
  }
}

async function executeAgents(client: GatewayBrowserClient): Promise<SlashCommandResult> {
  try {
    const result = await client.request<AgentsListResult>("agents.list", {});
    const agents = result?.agents ?? [];
    if (agents.length === 0) {
      return { content: "当前没有已配置的代理。" };
    }
    const lines = [`**代理列表**（${agents.length}）\n`];
    for (const agent of agents) {
      const isDefault = agent.id === result?.defaultId;
      const name = agent.identity?.name || agent.name || agent.id;
      const marker = isDefault ? " *(默认)*" : "";
      lines.push(`- \`${agent.id}\` — ${name}${marker}`);
    }
    return { content: lines.join("\n") };
  } catch (err) {
    return { content: `获取代理列表失败：${String(err)}` };
  }
}

async function executeKill(
  client: GatewayBrowserClient,
  sessionKey: string,
  args: string,
): Promise<SlashCommandResult> {
  const target = args.trim();
  if (!target) {
    return { content: "用法：`/kill <id|all>`" };
  }
  try {
    const sessions = await client.request<SessionsListResult>("sessions.list", {});
    const matched = resolveKillTargets(sessions?.sessions ?? [], sessionKey, target);
    if (matched.length === 0) {
      return {
        content:
          target.toLowerCase() === "all"
            ? "没有找到活动中的子代理会话。"
            : `没有找到与 \`${target}\` 匹配的子代理会话。`,
      };
    }

    const results = await Promise.allSettled(
      matched.map((key) =>
        client.request<{ aborted?: boolean }>("chat.abort", { sessionKey: key }),
      ),
    );
    const rejected = results.filter((entry) => entry.status === "rejected");
    const successCount = results.filter(
      (entry) =>
        entry.status === "fulfilled" && (entry.value as { aborted?: boolean })?.aborted !== false,
    ).length;
    if (successCount === 0) {
      if (rejected.length === 0) {
        return {
          content:
            target.toLowerCase() === "all"
              ? "没有活动中的子代理运行可中止。"
              : `没有与 \`${target}\` 匹配的活动运行。`,
        };
      }
      throw rejected[0]?.reason ?? new Error("abort failed");
    }

    if (target.toLowerCase() === "all") {
      return {
        content:
          successCount === matched.length
            ? `已中止 ${successCount} 个子代理会话。`
            : `已中止 ${matched.length} 个匹配会话中的 ${successCount} 个。`,
      };
    }

    return {
      content:
        successCount === matched.length
          ? `已中止与 \`${target}\` 匹配的 ${successCount} 个子代理会话。`
          : `已中止与 \`${target}\` 匹配的 ${matched.length} 个会话中的 ${successCount} 个。`,
    };
  } catch (err) {
    return { content: `中止子代理失败：${String(err)}` };
  }
}

function resolveKillTargets(
  sessions: GatewaySessionRow[],
  currentSessionKey: string,
  target: string,
): string[] {
  const normalizedTarget = target.trim().toLowerCase();
  if (!normalizedTarget) {
    return [];
  }

  const keys = new Set<string>();
  const normalizedCurrentSessionKey = currentSessionKey.trim().toLowerCase();
  const currentParsed = parseAgentSessionKey(normalizedCurrentSessionKey);
  const currentAgentId =
    currentParsed?.agentId ??
    (normalizedCurrentSessionKey === DEFAULT_MAIN_KEY ? DEFAULT_AGENT_ID : undefined);
  const sessionIndex = buildSessionIndex(sessions);
  for (const session of sessions) {
    const key = session?.key?.trim();
    if (!key || !isSubagentSessionKey(key)) {
      continue;
    }
    const normalizedKey = key.toLowerCase();
    const parsed = parseAgentSessionKey(normalizedKey);
    const belongsToCurrentSession = isWithinCurrentSessionSubtree(
      normalizedKey,
      normalizedCurrentSessionKey,
      sessionIndex,
      currentAgentId,
      parsed?.agentId,
    );
    const isMatch =
      (normalizedTarget === "all" && belongsToCurrentSession) ||
      (belongsToCurrentSession && normalizedKey === normalizedTarget) ||
      (belongsToCurrentSession &&
        ((parsed?.agentId ?? "") === normalizedTarget ||
          normalizedKey.endsWith(`:subagent:${normalizedTarget}`) ||
          normalizedKey === `subagent:${normalizedTarget}`));
    if (isMatch) {
      keys.add(key);
    }
  }
  return [...keys];
}

function isWithinCurrentSessionSubtree(
  candidateSessionKey: string,
  currentSessionKey: string,
  sessionIndex: Map<string, GatewaySessionRow>,
  currentAgentId: string | undefined,
  candidateAgentId: string | undefined,
): boolean {
  if (!currentAgentId || candidateAgentId !== currentAgentId) {
    return false;
  }

  const currentAliases = resolveEquivalentSessionKeys(currentSessionKey, currentAgentId);
  const seen = new Set<string>();
  let parentSessionKey = normalizeSessionKey(sessionIndex.get(candidateSessionKey)?.spawnedBy);
  while (parentSessionKey && !seen.has(parentSessionKey)) {
    if (currentAliases.has(parentSessionKey)) {
      return true;
    }
    seen.add(parentSessionKey);
    parentSessionKey = normalizeSessionKey(sessionIndex.get(parentSessionKey)?.spawnedBy);
  }

  // Older gateways may not include spawnedBy on session rows yet; keep prefix
  // matching for nested subagent sessions as a compatibility fallback.
  return isSubagentSessionKey(currentSessionKey)
    ? candidateSessionKey.startsWith(`${currentSessionKey}:subagent:`)
    : false;
}

function buildSessionIndex(sessions: GatewaySessionRow[]): Map<string, GatewaySessionRow> {
  const index = new Map<string, GatewaySessionRow>();
  for (const session of sessions) {
    const normalizedKey = normalizeSessionKey(session?.key);
    if (!normalizedKey) {
      continue;
    }
    index.set(normalizedKey, session);
  }
  return index;
}

function normalizeSessionKey(key?: string | null): string | undefined {
  const normalized = key?.trim().toLowerCase();
  return normalized || undefined;
}

function resolveEquivalentSessionKeys(
  currentSessionKey: string,
  currentAgentId: string | undefined,
): Set<string> {
  const keys = new Set<string>([currentSessionKey]);
  if (currentAgentId === DEFAULT_AGENT_ID) {
    const canonicalDefaultMain = `agent:${DEFAULT_AGENT_ID}:main`;
    if (currentSessionKey === DEFAULT_MAIN_KEY) {
      keys.add(canonicalDefaultMain);
    } else if (currentSessionKey === canonicalDefaultMain) {
      keys.add(DEFAULT_MAIN_KEY);
    }
  }
  return keys;
}

function formatDirectiveOptions(text: string, options: string): string {
  return `${text}\n可用选项：${options}。`;
}

async function loadCurrentSession(
  client: GatewayBrowserClient,
  sessionKey: string,
): Promise<GatewaySessionRow | undefined> {
  const sessions = await client.request<SessionsListResult>("sessions.list", {});
  return resolveCurrentSession(sessions, sessionKey);
}

function resolveCurrentSession(
  sessions: SessionsListResult | undefined,
  sessionKey: string,
): GatewaySessionRow | undefined {
  const normalizedSessionKey = normalizeSessionKey(sessionKey);
  const currentAgentId =
    parseAgentSessionKey(normalizedSessionKey ?? "")?.agentId ??
    (normalizedSessionKey === DEFAULT_MAIN_KEY ? DEFAULT_AGENT_ID : undefined);
  const aliases = normalizedSessionKey
    ? resolveEquivalentSessionKeys(normalizedSessionKey, currentAgentId)
    : new Set<string>();
  return sessions?.sessions?.find((session: GatewaySessionRow) => {
    const key = normalizeSessionKey(session.key);
    return key ? aliases.has(key) : false;
  });
}

async function loadThinkingCommandState(client: GatewayBrowserClient, sessionKey: string) {
  const [sessions, models] = await Promise.all([
    client.request<SessionsListResult>("sessions.list", {}),
    client.request<{ models: ModelCatalogEntry[] }>("models.list", {}),
  ]);
  return {
    session: resolveCurrentSession(sessions, sessionKey),
    models: models?.models ?? [],
  };
}

function resolveCurrentThinkingLevel(
  session: GatewaySessionRow | undefined,
  models: ModelCatalogEntry[],
): string {
  const persisted = normalizeThinkLevel(session?.thinkingLevel);
  if (persisted) {
    return persisted;
  }
  if (!session?.modelProvider || !session.model) {
    return "off";
  }
  return resolveThinkingDefaultForModel({
    provider: session.modelProvider,
    model: session.model,
    catalog: models,
  });
}

function resolveCurrentFastMode(session: GatewaySessionRow | undefined): "on" | "off" {
  return session?.fastMode === true ? "on" : "off";
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(n);
}
