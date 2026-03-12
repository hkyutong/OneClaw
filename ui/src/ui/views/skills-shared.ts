import { html, nothing } from "lit";
import type { SkillStatusEntry } from "../types.ts";

function localizeSkillMissingPrefix(prefix: "bin" | "env" | "config" | "os"): string {
  switch (prefix) {
    case "bin":
      return "命令";
    case "env":
      return "环境变量";
    case "config":
      return "配置";
    case "os":
      return "系统";
    default:
      return prefix;
  }
}

function localizeSkillSource(source: string): string {
  switch (source) {
    case "openclaw-workspace":
      return "工作区";
    case "openclaw-bundled":
      return "内置";
    case "openclaw-managed":
      return "已安装";
    case "openclaw-extra":
      return "扩展";
    default:
      return source;
  }
}

export function computeSkillMissing(skill: SkillStatusEntry): string[] {
  return [
    ...skill.missing.bins.map((b) => `${localizeSkillMissingPrefix("bin")}：${b}`),
    ...skill.missing.env.map((e) => `${localizeSkillMissingPrefix("env")}：${e}`),
    ...skill.missing.config.map((c) => `${localizeSkillMissingPrefix("config")}：${c}`),
    ...skill.missing.os.map((o) => `${localizeSkillMissingPrefix("os")}：${o}`),
  ];
}

export function computeSkillReasons(skill: SkillStatusEntry): string[] {
  const reasons: string[] = [];
  if (skill.disabled) {
    reasons.push("已禁用");
  }
  if (skill.blockedByAllowlist) {
    reasons.push("被允许列表阻止");
  }
  return reasons;
}

export function renderSkillStatusChips(params: {
  skill: SkillStatusEntry;
  showBundledBadge?: boolean;
}) {
  const skill = params.skill;
  const showBundledBadge = Boolean(params.showBundledBadge);
  return html`
    <div class="chip-row" style="margin-top: 6px;">
      <span class="chip">${localizeSkillSource(skill.source)}</span>
      ${
        showBundledBadge
          ? html`
              <span class="chip">内置</span>
            `
          : nothing
      }
      <span class="chip ${skill.eligible ? "chip-ok" : "chip-warn"}">
        ${skill.eligible ? "可用" : "受阻"}
      </span>
      ${
        skill.disabled
          ? html`
              <span class="chip chip-warn">已禁用</span>
            `
          : nothing
      }
    </div>
  `;
}
