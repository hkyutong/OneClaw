import { t } from "../i18n/index.ts";
import { formatRelativeTimestamp, formatDurationHuman, formatMs } from "./format.ts";
import type { CronJob, GatewaySessionRow, PresenceEntry } from "./types.ts";

export function formatPresenceSummary(entry: PresenceEntry): string {
  const host = entry.host ?? t("instances.unknownHost");
  const ip = entry.ip ? `(${entry.ip})` : "";
  const mode = entry.mode ?? "";
  const version = entry.version ?? "";
  return `${host} ${ip} ${mode} ${version}`.trim();
}

export function formatPresenceAge(entry: PresenceEntry): string {
  const ts = entry.ts ?? null;
  return ts ? formatRelativeTimestamp(ts) : t("common.na");
}

export function formatNextRun(ms?: number | null) {
  if (!ms) {
    return t("common.na");
  }
  const weekday = new Date(ms).toLocaleDateString(undefined, { weekday: "short" });
  return `${weekday}, ${formatMs(ms)} (${formatRelativeTimestamp(ms)})`;
}

export function formatSessionTokens(row: GatewaySessionRow) {
  if (row.totalTokens == null) {
    return t("common.na");
  }
  const total = row.totalTokens ?? 0;
  const ctx = row.contextTokens ?? 0;
  return ctx ? `${total} / ${ctx}` : String(total);
}

export function formatEventPayload(payload: unknown): string {
  if (payload == null) {
    return "";
  }
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    // oxlint-disable typescript/no-base-to-string
    return String(payload);
  }
}

export function formatCronState(job: CronJob) {
  const state = job.state ?? {};
  const next = state.nextRunAtMs ? formatMs(state.nextRunAtMs) : t("common.na");
  const last = state.lastRunAtMs ? formatMs(state.lastRunAtMs) : t("common.na");
  const status = state.lastStatus ?? t("common.na");
  return `${status} · ${t("cron.jobState.next")} ${next} · ${t("cron.jobState.last")} ${last}`;
}

export function formatCronSchedule(job: CronJob) {
  const s = job.schedule;
  if (s.kind === "at") {
    const atMs = Date.parse(s.at);
    return Number.isFinite(atMs)
      ? `${t("cron.form.at")} ${formatMs(atMs)}`
      : `${t("cron.form.at")} ${s.at}`;
  }
  if (s.kind === "every") {
    return `${t("cron.form.every")} ${formatDurationHuman(s.everyMs)}`;
  }
  return `${t("cron.form.cronOption")} ${s.expr}${s.tz ? ` (${s.tz})` : ""}`;
}

export function formatCronPayload(job: CronJob) {
  const p = job.payload;
  if (p.kind === "systemEvent") {
    return `${t("cron.jobDetail.system")}：${p.text}`;
  }
  const base = `${t("cron.jobDetail.agent")}：${p.message}`;
  const delivery = job.delivery;
  if (delivery && delivery.mode !== "none") {
    const target =
      delivery.mode === "webhook"
        ? delivery.to
          ? ` (${delivery.to})`
          : ""
        : delivery.channel || delivery.to
          ? ` (${delivery.channel ?? "last"}${delivery.to ? ` -> ${delivery.to}` : ""})`
          : "";
    return `${base} · ${delivery.mode}${target}`;
  }
  return base;
}
