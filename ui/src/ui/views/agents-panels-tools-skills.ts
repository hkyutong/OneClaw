import { html, nothing } from "lit";
import { normalizeToolName } from "../../../../src/agents/tool-policy-shared.js";
import type { SkillStatusEntry, SkillStatusReport, ToolsCatalogResult } from "../types.ts";
import {
  isAllowedByPolicy,
  matchesList,
  PROFILE_OPTIONS,
  resolveAgentConfig,
  resolveToolProfile,
  TOOL_SECTIONS,
} from "./agents-utils.ts";
import { localizeGatewayError } from "./overview-hints.ts";
import type { SkillGroup } from "./skills-grouping.ts";
import { groupSkills } from "./skills-grouping.ts";
import {
  computeSkillMissing,
  computeSkillReasons,
  renderSkillStatusChips,
} from "./skills-shared.ts";

function localizeProfileSource(source: "agent override" | "global default" | "default"): string {
  switch (source) {
    case "agent override":
      return "代理覆盖";
    case "global default":
      return "全局默认";
    default:
      return "默认";
  }
}

function resolveProfileLabel(profile: string): string {
  const option = PROFILE_OPTIONS.find((entry) => entry.id === profile);
  return option?.label ?? profile;
}

export function renderAgentTools(params: {
  agentId: string;
  configForm: Record<string, unknown> | null;
  configLoading: boolean;
  configSaving: boolean;
  configDirty: boolean;
  toolsCatalogLoading: boolean;
  toolsCatalogError: string | null;
  toolsCatalogResult: ToolsCatalogResult | null;
  onProfileChange: (agentId: string, profile: string | null, clearAllow: boolean) => void;
  onOverridesChange: (agentId: string, alsoAllow: string[], deny: string[]) => void;
  onConfigReload: () => void;
  onConfigSave: () => void;
}) {
  const config = resolveAgentConfig(params.configForm, params.agentId);
  const agentTools = config.entry?.tools ?? {};
  const globalTools = config.globalTools ?? {};
  const profile = agentTools.profile ?? globalTools.profile ?? "full";
  const profileSource = agentTools.profile
    ? "agent override"
    : globalTools.profile
      ? "global default"
      : "default";
  const hasAgentAllow = Array.isArray(agentTools.allow) && agentTools.allow.length > 0;
  const hasGlobalAllow = Array.isArray(globalTools.allow) && globalTools.allow.length > 0;
  const editable =
    Boolean(params.configForm) && !params.configLoading && !params.configSaving && !hasAgentAllow;
  const alsoAllow = hasAgentAllow
    ? []
    : Array.isArray(agentTools.alsoAllow)
      ? agentTools.alsoAllow
      : [];
  const deny = hasAgentAllow ? [] : Array.isArray(agentTools.deny) ? agentTools.deny : [];
  const basePolicy = hasAgentAllow
    ? { allow: agentTools.allow ?? [], deny: agentTools.deny ?? [] }
    : (resolveToolProfile(profile) ?? undefined);
  const sections =
    params.toolsCatalogResult?.groups?.length &&
    params.toolsCatalogResult.agentId === params.agentId
      ? params.toolsCatalogResult.groups
      : TOOL_SECTIONS;
  const profileOptions =
    params.toolsCatalogResult?.profiles?.length &&
    params.toolsCatalogResult.agentId === params.agentId
      ? params.toolsCatalogResult.profiles
      : PROFILE_OPTIONS;
  const toolIds = sections.flatMap((section) => section.tools.map((tool) => tool.id));

  const resolveAllowed = (toolId: string) => {
    const baseAllowed = isAllowedByPolicy(toolId, basePolicy);
    const extraAllowed = matchesList(toolId, alsoAllow);
    const denied = matchesList(toolId, deny);
    const allowed = (baseAllowed || extraAllowed) && !denied;
    return {
      allowed,
      baseAllowed,
      denied,
    };
  };
  const enabledCount = toolIds.filter((toolId) => resolveAllowed(toolId).allowed).length;

  const updateTool = (toolId: string, nextEnabled: boolean) => {
    const nextAllow = new Set(
      alsoAllow.map((entry) => normalizeToolName(entry)).filter((entry) => entry.length > 0),
    );
    const nextDeny = new Set(
      deny.map((entry) => normalizeToolName(entry)).filter((entry) => entry.length > 0),
    );
    const baseAllowed = resolveAllowed(toolId).baseAllowed;
    const normalized = normalizeToolName(toolId);
    if (nextEnabled) {
      nextDeny.delete(normalized);
      if (!baseAllowed) {
        nextAllow.add(normalized);
      }
    } else {
      nextAllow.delete(normalized);
      nextDeny.add(normalized);
    }
    params.onOverridesChange(params.agentId, [...nextAllow], [...nextDeny]);
  };

  const updateAll = (nextEnabled: boolean) => {
    const nextAllow = new Set(
      alsoAllow.map((entry) => normalizeToolName(entry)).filter((entry) => entry.length > 0),
    );
    const nextDeny = new Set(
      deny.map((entry) => normalizeToolName(entry)).filter((entry) => entry.length > 0),
    );
    for (const toolId of toolIds) {
      const baseAllowed = resolveAllowed(toolId).baseAllowed;
      const normalized = normalizeToolName(toolId);
      if (nextEnabled) {
        nextDeny.delete(normalized);
        if (!baseAllowed) {
          nextAllow.add(normalized);
        }
      } else {
        nextAllow.delete(normalized);
        nextDeny.add(normalized);
      }
    }
    params.onOverridesChange(params.agentId, [...nextAllow], [...nextDeny]);
  };

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">工具访问</div>
          <div class="card-sub">
            当前代理的预设策略与逐工具覆盖。
            已启用 <span class="mono">${enabledCount}/${toolIds.length}</span> 项。
          </div>
        </div>
        <div class="row" style="gap: 8px;">
          <button class="btn btn--sm" ?disabled=${!editable} @click=${() => updateAll(true)}>
            全部启用
          </button>
          <button class="btn btn--sm" ?disabled=${!editable} @click=${() => updateAll(false)}>
            全部禁用
          </button>
          <button class="btn btn--sm" ?disabled=${params.configLoading} @click=${params.onConfigReload}>
            重新加载配置
          </button>
          <button
            class="btn btn--sm primary"
            ?disabled=${params.configSaving || !params.configDirty}
            @click=${params.onConfigSave}
          >
            ${params.configSaving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>

      ${
        params.toolsCatalogError
          ? html`
              <div class="callout warn" style="margin-top: 12px">
                ${localizeGatewayError(params.toolsCatalogError) ?? "无法加载运行时工具目录，当前显示后备列表。"}
              </div>
            `
          : nothing
      }
      ${
        !params.configForm
          ? html`
              <div class="callout info" style="margin-top: 12px">请先加载网关配置，再调整工具策略。</div>
            `
          : nothing
      }
      ${
        hasAgentAllow
          ? html`
              <div class="callout info" style="margin-top: 12px">
                当前代理使用了配置中的显式允许列表，请在“配置”页中管理工具覆盖项。
              </div>
            `
          : nothing
      }
      ${
        hasGlobalAllow
          ? html`
              <div class="callout info" style="margin-top: 12px">
                全局已设置 <span class="mono">tools.allow</span>，代理无法启用被全局阻止的工具。
              </div>
            `
          : nothing
      }

      <div class="agent-tools-meta" style="margin-top: 16px;">
        <div class="agent-kv">
          <div class="label">预设</div>
          <div class="mono">${resolveProfileLabel(profile)}</div>
        </div>
        <div class="agent-kv">
          <div class="label">来源</div>
          <div>${localizeProfileSource(profileSource)}</div>
        </div>
        ${
          params.configDirty
            ? html`
                <div class="agent-kv">
                  <div class="label">状态</div>
                  <div class="mono">未保存</div>
                </div>
              `
            : nothing
        }
      </div>

      <div class="agent-tools-presets" style="margin-top: 16px;">
        <div class="label">快速预设</div>
        <div class="agent-tools-buttons">
          ${profileOptions.map(
            (option) => html`
              <button
                class="btn btn--sm ${profile === option.id ? "active" : ""}"
                ?disabled=${!editable}
                @click=${() => params.onProfileChange(params.agentId, option.id, true)}
              >
                ${option.label}
              </button>
            `,
          )}
          <button
            class="btn btn--sm"
            ?disabled=${!editable}
            @click=${() => params.onProfileChange(params.agentId, null, false)}
          >
            继承
          </button>
        </div>
      </div>

      <div class="agent-tools-grid" style="margin-top: 20px;">
        ${sections.map(
          (section) =>
            html`
              <div class="agent-tools-section">
                <div class="agent-tools-header">
                  ${section.label}
                  ${
                    "source" in section && section.source === "plugin"
                      ? html`
                          <span class="mono" style="margin-left: 6px">插件</span>
                        `
                      : nothing
                  }
                </div>
                <div class="agent-tools-list">
                  ${section.tools.map((tool) => {
                    const { allowed } = resolveAllowed(tool.id);
                    const catalogTool = tool as {
                      source?: "core" | "plugin";
                      pluginId?: string;
                      optional?: boolean;
                    };
                    const source =
                      catalogTool.source === "plugin"
                        ? catalogTool.pluginId
                          ? `插件：${catalogTool.pluginId}`
                          : "插件"
                        : "内置";
                    const isOptional = catalogTool.optional === true;
                    return html`
                      <div class="agent-tool-row">
                        <div>
                          <div class="agent-tool-title mono">
                            ${tool.label}
                            <span class="mono" style="margin-left: 8px; opacity: 0.8;">${source}</span>
                            ${
                              isOptional
                                ? html`
                                    <span class="mono" style="margin-left: 6px; opacity: 0.8">可选</span>
                                  `
                                : nothing
                            }
                          </div>
                          <div class="agent-tool-sub">${tool.description}</div>
                        </div>
                        <label class="cfg-toggle">
                          <input
                            type="checkbox"
                            .checked=${allowed}
                            ?disabled=${!editable}
                            @change=${(e: Event) =>
                              updateTool(tool.id, (e.target as HTMLInputElement).checked)}
                          />
                          <span class="cfg-toggle__track"></span>
                        </label>
                      </div>
                    `;
                  })}
                </div>
              </div>
            `,
        )}
      </div>
      ${
        params.toolsCatalogLoading
          ? html`
              <div class="card-sub" style="margin-top: 10px">正在刷新工具目录…</div>
            `
          : nothing
      }
    </section>
  `;
}

export function renderAgentSkills(params: {
  agentId: string;
  report: SkillStatusReport | null;
  loading: boolean;
  error: string | null;
  activeAgentId: string | null;
  configForm: Record<string, unknown> | null;
  configLoading: boolean;
  configSaving: boolean;
  configDirty: boolean;
  filter: string;
  onFilterChange: (next: string) => void;
  onRefresh: () => void;
  onToggle: (agentId: string, skillName: string, enabled: boolean) => void;
  onClear: (agentId: string) => void;
  onDisableAll: (agentId: string) => void;
  onConfigReload: () => void;
  onConfigSave: () => void;
}) {
  const editable = Boolean(params.configForm) && !params.configLoading && !params.configSaving;
  const config = resolveAgentConfig(params.configForm, params.agentId);
  const allowlist = Array.isArray(config.entry?.skills) ? config.entry?.skills : undefined;
  const allowSet = new Set((allowlist ?? []).map((name) => name.trim()).filter(Boolean));
  const usingAllowlist = allowlist !== undefined;
  const reportReady = Boolean(params.report && params.activeAgentId === params.agentId);
  const rawSkills = reportReady ? (params.report?.skills ?? []) : [];
  const filter = params.filter.trim().toLowerCase();
  const filtered = filter
    ? rawSkills.filter((skill) =>
        [skill.name, skill.description, skill.source].join(" ").toLowerCase().includes(filter),
      )
    : rawSkills;
  const groups = groupSkills(filtered);
  const enabledCount = usingAllowlist
    ? rawSkills.filter((skill) => allowSet.has(skill.name)).length
    : rawSkills.length;
  const totalCount = rawSkills.length;

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">技能</div>
          <div class="card-sub">
            代理级技能允许列表与工作区技能。
            ${
              totalCount > 0
                ? html`<span class="mono">${enabledCount}/${totalCount}</span>`
                : nothing
            }
          </div>
        </div>
        <div class="row" style="gap: 8px;">
          <button class="btn btn--sm" ?disabled=${!editable} @click=${() => params.onClear(params.agentId)}>
            启用全部
          </button>
          <button
            class="btn btn--sm"
            ?disabled=${!editable}
            @click=${() => params.onDisableAll(params.agentId)}
          >
            全部禁用
          </button>
          <button class="btn btn--sm" ?disabled=${params.configLoading} @click=${params.onConfigReload}>
            重新加载配置
          </button>
          <button class="btn btn--sm" ?disabled=${params.loading} @click=${params.onRefresh}>
            ${params.loading ? "加载中…" : "刷新"}
          </button>
          <button
            class="btn btn--sm primary"
            ?disabled=${params.configSaving || !params.configDirty}
            @click=${params.onConfigSave}
          >
            ${params.configSaving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>

      ${
        !params.configForm
          ? html`
              <div class="callout info" style="margin-top: 12px">请先加载网关配置，再设置代理级技能。</div>
            `
          : nothing
      }
      ${
        usingAllowlist
          ? html`
              <div class="callout info" style="margin-top: 12px">当前代理正在使用自定义技能允许列表。</div>
            `
          : html`
              <div class="callout info" style="margin-top: 12px">
                当前全部技能均已启用。禁用任意技能后会自动创建代理级允许列表。
              </div>
            `
      }
      ${
        !reportReady && !params.loading
          ? html`
              <div class="callout info" style="margin-top: 12px">
                加载当前代理的技能后即可查看工作区专属条目。
              </div>
            `
          : nothing
      }
      ${
        params.error
          ? html`
              <div class="callout danger" style="margin-top: 12px;">
                ${localizeGatewayError(params.error) ?? params.error}
              </div>
            `
          : nothing
      }

      <div class="filters" style="margin-top: 14px;">
        <label class="field" style="flex: 1;">
          <span>筛选</span>
          <input
            .value=${params.filter}
            @input=${(e: Event) => params.onFilterChange((e.target as HTMLInputElement).value)}
            placeholder="搜索技能"
          />
        </label>
        <div class="muted">显示 ${filtered.length} 项</div>
      </div>

      ${
        filtered.length === 0
          ? html`
              <div class="muted" style="margin-top: 16px">未找到任何技能。</div>
            `
          : html`
              <div class="agent-skills-groups" style="margin-top: 16px;">
                ${groups.map((group) =>
                  renderAgentSkillGroup(group, {
                    agentId: params.agentId,
                    allowSet,
                    usingAllowlist,
                    editable,
                    onToggle: params.onToggle,
                  }),
                )}
              </div>
            `
      }
    </section>
  `;
}

function renderAgentSkillGroup(
  group: SkillGroup,
  params: {
    agentId: string;
    allowSet: Set<string>;
    usingAllowlist: boolean;
    editable: boolean;
    onToggle: (agentId: string, skillName: string, enabled: boolean) => void;
  },
) {
  const collapsedByDefault = group.id === "workspace" || group.id === "built-in";
  return html`
    <details class="agent-skills-group" ?open=${!collapsedByDefault}>
      <summary class="agent-skills-header">
        <span>${group.label}</span>
        <span class="muted">${group.skills.length}</span>
      </summary>
      <div class="list skills-grid">
        ${group.skills.map((skill) =>
          renderAgentSkillRow(skill, {
            agentId: params.agentId,
            allowSet: params.allowSet,
            usingAllowlist: params.usingAllowlist,
            editable: params.editable,
            onToggle: params.onToggle,
          }),
        )}
      </div>
    </details>
  `;
}

function renderAgentSkillRow(
  skill: SkillStatusEntry,
  params: {
    agentId: string;
    allowSet: Set<string>;
    usingAllowlist: boolean;
    editable: boolean;
    onToggle: (agentId: string, skillName: string, enabled: boolean) => void;
  },
) {
  const enabled = params.usingAllowlist ? params.allowSet.has(skill.name) : true;
  const missing = computeSkillMissing(skill);
  const reasons = computeSkillReasons(skill);
  return html`
    <div class="list-item agent-skill-row">
      <div class="list-main">
        <div class="list-title">${skill.emoji ? `${skill.emoji} ` : ""}${skill.name}</div>
        <div class="list-sub">${skill.description}</div>
        ${renderSkillStatusChips({ skill })}
        ${
          missing.length > 0
            ? html`<div class="muted" style="margin-top: 6px;">缺失：${missing.join(", ")}</div>`
            : nothing
        }
        ${
          reasons.length > 0
            ? html`<div class="muted" style="margin-top: 6px;">原因：${reasons.join(", ")}</div>`
            : nothing
        }
      </div>
      <div class="list-meta">
        <label class="cfg-toggle">
          <input
            type="checkbox"
            .checked=${enabled}
            ?disabled=${!params.editable}
            @change=${(e: Event) =>
              params.onToggle(params.agentId, skill.name, (e.target as HTMLInputElement).checked)}
          />
          <span class="cfg-toggle__track"></span>
        </label>
      </div>
    </div>
  `;
}
