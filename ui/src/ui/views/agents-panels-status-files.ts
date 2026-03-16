import { html, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { formatRelativeTimestamp } from "../format.ts";
import { icons } from "../icons.ts";
import { toSanitizedMarkdownHtml } from "../markdown.ts";
import {
  formatCronPayload,
  formatCronSchedule,
  formatCronState,
  formatNextRun,
} from "../presenter.ts";
import type {
  AgentFileEntry,
  AgentsFilesListResult,
  ChannelAccountSnapshot,
  ChannelsStatusSnapshot,
  CronJob,
  CronStatus,
} from "../types.ts";
import { formatBytes, type AgentContext } from "./agents-utils.ts";
import { resolveChannelExtras as resolveChannelExtrasFromConfig } from "./channel-config-extras.ts";

function renderAgentContextCard(context: AgentContext, subtitle: string) {
  return html`
    <section class="card">
      <div class="card-title">代理上下文</div>
      <div class="card-sub">${subtitle}</div>
      <div class="agents-overview-grid" style="margin-top: 16px;">
        <div class="agent-kv">
          <div class="label">工作区</div>
          <div class="mono">${context.workspace}</div>
        </div>
        <div class="agent-kv">
          <div class="label">主模型</div>
          <div class="mono">${context.model}</div>
        </div>
        <div class="agent-kv">
          <div class="label">身份名称</div>
          <div>${context.identityName}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Identity Avatar</div>
          <div>${context.identityAvatar}</div>
        </div>
        <div class="agent-kv">
          <div class="label">技能筛选</div>
          <div>${context.skillsLabel}</div>
        </div>
        <div class="agent-kv">
          <div class="label">默认</div>
          <div>${context.isDefault ? "是" : "否"}</div>
        </div>
      </div>
    </section>
  `;
}

type ChannelSummaryEntry = {
  id: string;
  label: string;
  accounts: ChannelAccountSnapshot[];
};

function resolveChannelLabel(snapshot: ChannelsStatusSnapshot, id: string) {
  const meta = snapshot.channelMeta?.find((entry) => entry.id === id);
  if (meta?.label) {
    return meta.label;
  }
  return snapshot.channelLabels?.[id] ?? id;
}

function resolveChannelEntries(snapshot: ChannelsStatusSnapshot | null): ChannelSummaryEntry[] {
  if (!snapshot) {
    return [];
  }
  const ids = new Set<string>();
  for (const id of snapshot.channelOrder ?? []) {
    ids.add(id);
  }
  for (const entry of snapshot.channelMeta ?? []) {
    ids.add(entry.id);
  }
  for (const id of Object.keys(snapshot.channelAccounts ?? {})) {
    ids.add(id);
  }
  const ordered: string[] = [];
  const seed = snapshot.channelOrder?.length ? snapshot.channelOrder : Array.from(ids);
  for (const id of seed) {
    if (!ids.has(id)) {
      continue;
    }
    ordered.push(id);
    ids.delete(id);
  }
  for (const id of ids) {
    ordered.push(id);
  }
  return ordered.map((id) => ({
    id,
    label: resolveChannelLabel(snapshot, id),
    accounts: snapshot.channelAccounts?.[id] ?? [],
  }));
}

const CHANNEL_EXTRA_FIELDS = ["groupPolicy", "streamMode", "dmPolicy"] as const;

function summarizeChannelAccounts(accounts: ChannelAccountSnapshot[]) {
  let connected = 0;
  let configured = 0;
  let enabled = 0;
  for (const account of accounts) {
    const probeOk =
      account.probe && typeof account.probe === "object" && "ok" in account.probe
        ? Boolean((account.probe as { ok?: unknown }).ok)
        : false;
    const isConnected = account.connected === true || account.running === true || probeOk;
    if (isConnected) {
      connected += 1;
    }
    if (account.configured) {
      configured += 1;
    }
    if (account.enabled) {
      enabled += 1;
    }
  }
  return {
    total: accounts.length,
    connected,
    configured,
    enabled,
  };
}

export function renderAgentChannels(params: {
  context: AgentContext;
  configForm: Record<string, unknown> | null;
  snapshot: ChannelsStatusSnapshot | null;
  loading: boolean;
  error: string | null;
  lastSuccess: number | null;
  onRefresh: () => void;
}) {
  const entries = resolveChannelEntries(params.snapshot);
  const lastSuccessLabel = params.lastSuccess
    ? formatRelativeTimestamp(params.lastSuccess)
    : "从未";
  return html`
    <section class="grid grid-cols-2">
      ${renderAgentContextCard(params.context, "工作区、身份与模型配置。")}
      <section class="card">
        <div class="row" style="justify-content: space-between;">
          <div>
            <div class="card-title">频道</div>
            <div class="card-sub">网关级频道状态快照。</div>
          </div>
          <button class="btn btn--sm" ?disabled=${params.loading} @click=${params.onRefresh}>
            ${params.loading ? "刷新中…" : "刷新"}
          </button>
        </div>
        <div class="muted" style="margin-top: 8px;">
          最后刷新：${lastSuccessLabel}
        </div>
        ${
          params.error
            ? html`<div class="callout danger" style="margin-top: 12px;">${params.error}</div>`
            : nothing
        }
        ${
          !params.snapshot
            ? html`
                <div class="callout info" style="margin-top: 12px">加载频道后即可查看实时状态。</div>
              `
            : nothing
        }
        ${
          entries.length === 0
            ? html`
                <div class="muted" style="margin-top: 16px">未找到任何频道。</div>
              `
            : html`
                <div class="list" style="margin-top: 16px;">
                  ${entries.map((entry) => {
                    const summary = summarizeChannelAccounts(entry.accounts);
                    const status = summary.total
                      ? `${summary.connected}/${summary.total} connected`
                      : "no accounts";
                    const configLabel = summary.configured
                      ? `${summary.configured} configured`
                      : "not configured";
                    const enabled = summary.total ? `${summary.enabled} enabled` : "disabled";
                    const extras = resolveChannelExtrasFromConfig({
                      configForm: params.configForm,
                      channelId: entry.id,
                      fields: CHANNEL_EXTRA_FIELDS,
                    });
                    return html`
                      <div class="list-item">
                        <div class="list-main">
                          <div class="list-title">${entry.label}</div>
                          <div class="list-sub mono">${entry.id}</div>
                        </div>
                        <div class="list-meta">
                          <div>${status}</div>
                          <div>${configLabel}</div>
                          <div>${enabled}</div>
                          ${
                            summary.configured === 0
                              ? html`
                                  <div>
                                    <a
                                      href="https://docs.openclaw.ai/channels"
                                      target="_blank"
                                      rel="noopener"
                                      style="color: var(--accent); font-size: 12px"
                                      >Setup guide</a
                                    >
                                  </div>
                                `
                              : nothing
                          }
                          ${
                            extras.length > 0
                              ? extras.map(
                                  (extra) => html`<div>${extra.label}: ${extra.value}</div>`,
                                )
                              : nothing
                          }
                        </div>
                      </div>
                    `;
                  })}
                </div>
              `
        }
      </section>
    </section>
  `;
}

export function renderAgentCron(params: {
  context: AgentContext;
  agentId: string;
  jobs: CronJob[];
  status: CronStatus | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onRunNow: (jobId: string) => void;
}) {
  const jobs = params.jobs.filter((job) => job.agentId === params.agentId);
  return html`
    <section class="grid grid-cols-2">
      ${renderAgentContextCard(params.context, "工作区与调度目标。")}
      <section class="card">
        <div class="row" style="justify-content: space-between;">
          <div>
            <div class="card-title">调度器</div>
            <div class="card-sub">网关定时任务状态。</div>
          </div>
          <button class="btn btn--sm" ?disabled=${params.loading} @click=${params.onRefresh}>
            ${params.loading ? "刷新中…" : "刷新"}
          </button>
        </div>
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">已启用</div>
            <div class="stat-value">
              ${params.status ? (params.status.enabled ? "是" : "否") : "不适用"}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">任务数</div>
            <div class="stat-value">${params.status?.jobs ?? "不适用"}</div>
          </div>
          <div class="stat">
            <div class="stat-label">下次唤醒</div>
            <div class="stat-value">${formatNextRun(params.status?.nextWakeAtMs ?? null)}</div>
          </div>
        </div>
        ${
          params.error
            ? html`<div class="callout danger" style="margin-top: 12px;">${params.error}</div>`
            : nothing
        }
      </section>
    </section>
    <section class="card">
      <div class="card-title">代理定时任务</div>
      <div class="card-sub">面向当前代理的计划任务。</div>
      ${
        jobs.length === 0
          ? html`
              <div class="muted" style="margin-top: 16px">当前没有分配任务。</div>
            `
          : html`
              <div class="list" style="margin-top: 16px;">
                ${jobs.map(
                  (job) => html`
                    <div class="list-item">
                      <div class="list-main">
                        <div class="list-title">${job.name}</div>
                        ${
                          job.description
                            ? html`<div class="list-sub">${job.description}</div>`
                            : nothing
                        }
                        <div class="chip-row" style="margin-top: 6px;">
                          <span class="chip">${formatCronSchedule(job)}</span>
                          <span class="chip ${job.enabled ? "chip-ok" : "chip-warn"}">
                            ${job.enabled ? "已启用" : "已禁用"}
                          </span>
                          <span class="chip">${job.sessionTarget}</span>
                        </div>
                      </div>
                      <div class="list-meta">
                        <div class="mono">${formatCronState(job)}</div>
                        <div class="muted">${formatCronPayload(job)}</div>
                        <button
                          class="btn btn--sm"
                          style="margin-top: 6px;"
                          ?disabled=${!job.enabled}
                          @click=${() => params.onRunNow(job.id)}
                        >Run Now</button>
                      </div>
                    </div>
                  `,
                )}
              </div>
            `
      }
    </section>
  `;
}

export function renderAgentFiles(params: {
  agentId: string;
  agentFilesList: AgentsFilesListResult | null;
  agentFilesLoading: boolean;
  agentFilesError: string | null;
  agentFileActive: string | null;
  agentFileContents: Record<string, string>;
  agentFileDrafts: Record<string, string>;
  agentFileSaving: boolean;
  onLoadFiles: (agentId: string) => void;
  onSelectFile: (name: string) => void;
  onFileDraftChange: (name: string, content: string) => void;
  onFileReset: (name: string) => void;
  onFileSave: (name: string) => void;
}) {
  const list = params.agentFilesList?.agentId === params.agentId ? params.agentFilesList : null;
  const files = list?.files ?? [];
  const active = params.agentFileActive ?? null;
  const activeEntry = active ? (files.find((file) => file.name === active) ?? null) : null;
  const baseContent = active ? (params.agentFileContents[active] ?? "") : "";
  const draft = active ? (params.agentFileDrafts[active] ?? baseContent) : "";
  const isDirty = active ? draft !== baseContent : false;

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">核心文件</div>
          <div class="card-sub">启动人设、身份与工具指引。</div>
        </div>
        <button
          class="btn btn--sm"
          ?disabled=${params.agentFilesLoading}
          @click=${() => params.onLoadFiles(params.agentId)}
        >
          ${params.agentFilesLoading ? "加载中…" : "刷新"}
        </button>
      </div>
      ${
        list
          ? html`<div class="muted mono" style="margin-top: 8px;">工作区：${list.workspace}</div>`
          : nothing
      }
      ${
        params.agentFilesError
          ? html`<div class="callout danger" style="margin-top: 12px;">${params.agentFilesError}</div>`
          : nothing
      }
      ${
        !list
          ? html`
              <div class="callout info" style="margin-top: 12px">加载代理工作区文件后即可编辑核心指令。</div>
            `
          : html`
              <div class="agent-files-grid" style="margin-top: 16px;">
                <div class="agent-files-list">
                  ${
                    files.length === 0
                      ? html`
                          <div class="muted">未找到任何文件。</div>
                        `
                      : files.map((file) =>
                          renderAgentFileRow(file, active, () => params.onSelectFile(file.name)),
                        )
                  }
                </div>
                <div class="agent-files-editor">
                  ${
                    !activeEntry
                      ? html`
                          <div class="muted">选择一个文件进行编辑。</div>
                        `
                      : html`
                          <div class="agent-file-header">
                            <div>
                              <div class="agent-file-title mono">${activeEntry.name}</div>
                              <div class="agent-file-sub mono">${activeEntry.path}</div>
                            </div>
                            <div class="agent-file-actions">
                              <button
                                class="btn btn--sm"
                                title="Preview rendered markdown"
                                @click=${(e: Event) => {
                                  const btn = e.currentTarget as HTMLElement;
                                  const dialog = btn
                                    .closest(".agent-files-editor")
                                    ?.querySelector("dialog");
                                  if (dialog) {
                                    dialog.showModal();
                                  }
                                }}
                              >
                                ${icons.eye} Preview
                              </button>
                              <button
                                class="btn btn--sm"
                                ?disabled=${!isDirty}
                                @click=${() => params.onFileReset(activeEntry.name)}
                              >
                                重置
                              </button>
                              <button
                                class="btn btn--sm primary"
                                ?disabled=${params.agentFileSaving || !isDirty}
                                @click=${() => params.onFileSave(activeEntry.name)}
                              >
                                ${params.agentFileSaving ? "保存中…" : "保存"}
                              </button>
                            </div>
                          </div>
                          ${
                            activeEntry.missing
                              ? html`
                                  <div class="callout info" style="margin-top: 10px">
                                    该文件当前不存在，保存后会在代理工作区中自动创建。
                                  </div>
                                `
                              : nothing
                          }
                          <label class="field agent-file-field" style="margin-top: 12px;">
                            <span>Content</span>
                            <textarea
                              class="agent-file-textarea"
                              .value=${draft}
                              @input=${(e: Event) =>
                                params.onFileDraftChange(
                                  activeEntry.name,
                                  (e.target as HTMLTextAreaElement).value,
                                )}
                            ></textarea>
                          </label>
                          <dialog
                            class="md-preview-dialog"
                            @click=${(e: Event) => {
                              const dialog = e.currentTarget as HTMLDialogElement;
                              if (e.target === dialog) {
                                dialog.close();
                              }
                            }}
                          >
                            <div class="md-preview-dialog__panel">
                              <div class="md-preview-dialog__header">
                                <div class="md-preview-dialog__title mono">${activeEntry.name}</div>
                                <button
                                  class="btn btn--sm"
                                  @click=${(e: Event) => {
                                    (e.currentTarget as HTMLElement).closest("dialog")?.close();
                                  }}
                                >${icons.x} Close</button>
                              </div>
                              <div class="md-preview-dialog__body sidebar-markdown">
                                ${unsafeHTML(toSanitizedMarkdownHtml(draft))}
                              </div>
                            </div>
                          </dialog>
                        `
                  }
                </div>
              </div>
            `
      }
    </section>
  `;
}

function renderAgentFileRow(file: AgentFileEntry, active: string | null, onSelect: () => void) {
  const status = file.missing
    ? "缺失"
    : `${formatBytes(file.size)} · ${formatRelativeTimestamp(file.updatedAtMs ?? null)}`;
  return html`
    <button
      type="button"
      class="agent-file-row ${active === file.name ? "active" : ""}"
      @click=${onSelect}
    >
      <div>
        <div class="agent-file-name mono">${file.name}</div>
        <div class="agent-file-meta">${status}</div>
      </div>
      ${
        file.missing
          ? html`
              <span class="agent-pill warn">缺失</span>
            `
          : nothing
      }
    </button>
  `;
}
