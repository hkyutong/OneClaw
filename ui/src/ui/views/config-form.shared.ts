import { i18n } from "../../i18n/lib/translate.ts";
import type { ConfigUiHints } from "../types.ts";

export type JsonSchema = {
  type?: string | string[];
  title?: string;
  description?: string;
  tags?: string[];
  "x-tags"?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema | JsonSchema[];
  additionalProperties?: JsonSchema | boolean;
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  nullable?: boolean;
};

const CONFIG_TEXT_MAP = new Map<string, string>([
  ["Plugins", "插件"],
  ["Plugin Allowlist", "插件允许列表"],
  ["Plugin Denylist", "插件拒绝列表"],
  ["Enable Plugins", "启用插件"],
  ["Plugin Loader", "插件加载器"],
  ["Plugin Load Paths", "插件加载路径"],
  ["Plugin Slots", "插件槽位"],
  ["Memory Plugin", "内存插件"],
  ["Context Engine Plugin", "上下文引擎插件"],
  ["Plugin Entries", "插件条目"],
  ["Plugin Enabled", "插件已启用"],
  ["Plugin Hook Policy", "插件钩子策略"],
  ["Allow Prompt Injection Hooks", "允许提示词注入钩子"],
  ["Plugin API Key", "插件 API 密钥"],
  ["Plugin Environment Variables", "插件环境变量"],
  ["Plugin Config", "插件配置"],
  ["Plugin Install Records", "插件安装记录"],
  ["Plugin Install Source", "插件安装来源"],
  ["Plugin Install Spec", "插件安装规范"],
  ["Plugin Install Source Path", "插件安装来源路径"],
  ["Plugin Install Path", "插件安装路径"],
  ["Plugin Install Version", "插件安装版本"],
  ["Plugin Resolved Package Name", "插件解析后的包名"],
  ["Plugin Resolved Package Version", "插件解析后的包版本"],
  ["Plugin Resolved Package Spec", "插件解析后的包规范"],
  ["Plugin Resolved Integrity", "插件解析后的完整性校验"],
  ["Plugin Resolved Shasum", "插件解析后的 Shasum"],
  ["Plugin Resolution Time", "插件解析时间"],
  ["Plugin Install Time", "插件安装时间"],
  [
    "Plugin system controls for enabling extensions, constraining load scope, configuring entries, and tracking installs. Keep plugin policy explicit and least-privilege in production environments.",
    "插件系统控制项，用于启用扩展、限制加载范围、配置插件条目并跟踪安装记录。生产环境中请保持插件策略清晰明确，并遵循最小权限原则。",
  ],
  [
    "Enable or disable plugin/extension loading globally during startup and config reload (default: true). Keep enabled only when extension capabilities are required by your deployment.",
    "在启动和重新加载配置时，全局启用或禁用插件/扩展加载（默认：true）。仅在你的部署确实需要扩展能力时保持启用。",
  ],
  [
    "Optional allowlist of plugin IDs; when set, only listed plugins are eligible to load. Use this to enforce approved extension inventories in controlled environments.",
    "可选的插件允许列表（按插件 ID）。设置后，只有列出的插件才允许加载。可用于在受控环境中强制使用已批准的扩展清单。",
  ],
  [
    "Optional denylist of plugin IDs that are blocked even if allowlists or paths include them. Use deny rules for emergency rollback and hard blocks on risky plugins.",
    "可选的插件拒绝列表（按插件 ID）。即使允许列表或加载路径包含这些插件，也会被强制阻止。可用于紧急回滚或永久封禁高风险插件。",
  ],
  [
    "Plugin loader configuration group for specifying filesystem paths where plugins are discovered. Keep load paths explicit and reviewed to avoid accidental untrusted extension loading.",
    "插件加载器配置组，用于指定从哪些文件系统路径发现插件。请保持加载路径明确且经过审核，避免误加载不受信任的扩展。",
  ],
  [
    "Additional plugin files or directories scanned by the loader beyond built-in defaults. Use dedicated extension directories and avoid broad paths with unrelated executable content.",
    "除内置默认路径外，加载器额外扫描的插件文件或目录。建议使用专门的扩展目录，并避免包含无关可执行内容的宽泛路径。",
  ],
  [
    "Selects which plugins own exclusive runtime slots such as memory so only one plugin provides that capability. Use explicit slot ownership to avoid overlapping providers with conflicting behavior.",
    "选择哪些插件占用独占运行时槽位，例如内存槽位，从而保证某项能力只由一个插件提供。请显式指定槽位归属，避免多个提供者行为冲突。",
  ],
  [
    'Select the active memory plugin by id, or "none" to disable memory plugins.',
    '按插件 ID 选择当前启用的内存插件，或填写 "none" 以禁用内存插件。',
  ],
  [
    "Selects the active context engine plugin by id so one plugin provides context orchestration behavior.",
    "按插件 ID 选择当前启用的上下文引擎插件，使上下文编排能力只由一个插件提供。",
  ],
  [
    "Per-plugin settings keyed by plugin ID including enablement and plugin-specific runtime configuration payloads. Use this for scoped plugin tuning without changing global loader policy.",
    "按插件 ID 组织的逐插件设置，包含启用状态和插件专属的运行时配置。可用于在不改动全局加载策略的前提下，单独调整某个插件。",
  ],
  [
    "Per-plugin enablement override for a specific entry, applied on top of global plugin policy (restart required). Use this to stage plugin rollout gradually across environments.",
    "针对单个插件条目的启用开关，会覆盖全局插件策略（需要重启）。可用于在不同环境中逐步发布插件。",
  ],
  [
    "Per-plugin typed hook policy controls for core-enforced safety gates. Use this to constrain high-impact hook categories without disabling the entire plugin.",
    "针对单个插件的类型化钩子策略控制，用于核心层的安全闸门。可在不禁用整个插件的情况下，限制高影响力的钩子类别。",
  ],
  [
    "Controls whether this plugin may mutate prompts through typed hooks. Set false to block `before_prompt_build` and ignore prompt-mutating fields from legacy `before_agent_start`, while preserving legacy `modelOverride` and `providerOverride` behavior.",
    "控制该插件是否允许通过类型化钩子修改提示词。设为 false 后，会阻止 `before_prompt_build`，并忽略旧版 `before_agent_start` 中会改写提示词的字段，同时保留旧版 `modelOverride` 和 `providerOverride` 行为。",
  ],
  [
    "Optional API key field consumed by plugins that accept direct key configuration in entry settings. Use secret/env substitution and avoid committing real credentials into config files.",
    "可选的 API 密钥字段，供支持在插件条目中直接配置密钥的插件使用。请优先使用 secret/env 替换，避免把真实凭据提交进配置文件。",
  ],
  [
    "Per-plugin environment variable map injected for that plugin runtime context only. Use this to scope provider credentials to one plugin instead of sharing global process environment.",
    "仅注入到该插件运行时上下文中的环境变量映射。可用于把供应商凭据限定在单个插件内，而不是共享给整个进程环境。",
  ],
  [
    "Plugin-defined configuration payload interpreted by that plugin's own schema and validation rules. Use only documented fields from the plugin to prevent ignored or invalid settings.",
    "由插件自定义的配置载荷，会按照该插件自身的 schema 和校验规则解析。请仅使用插件文档中声明的字段，避免配置被忽略或判定为无效。",
  ],
  [
    "CLI-managed install metadata (used by `openclaw plugins update` to locate install sources).",
    "由 CLI 管理的安装元数据（`openclaw plugins update` 会用它来定位安装来源）。",
  ],
  ['Install source ("npm", "archive", or "path").', '安装来源（"npm"、"archive" 或 "path"）。'],
  [
    "Original npm spec used for install (if source is npm).",
    "安装时使用的原始 npm 规范（当来源为 npm 时）。",
  ],
  ["Original archive/path used for install (if any).", "安装时使用的原始压缩包或路径（如有）。"],
  [
    "Resolved install directory (usually ~/.openclaw/extensions/<id>).",
    "解析后的安装目录（通常为 ~/.openclaw/extensions/<id>）。",
  ],
  ["Version recorded at install time (if available).", "安装时记录的版本号（如有）。"],
  ["Resolved npm package name from the fetched artifact.", "从拉取到的制品中解析出的 npm 包名。"],
  [
    "Resolved npm package version from the fetched artifact (useful for non-pinned specs).",
    "从拉取到的制品中解析出的 npm 包版本（对未锁定版本的规范尤其有用）。",
  ],
  [
    "Resolved exact npm spec (<name>@<version>) from the fetched artifact.",
    "从拉取到的制品中解析出的精确 npm 规范（<name>@<version>）。",
  ],
  [
    "Resolved npm dist integrity hash for the fetched artifact (if reported by npm).",
    "从拉取到的制品中解析出的 npm dist integrity 哈希（如果 npm 有返回）。",
  ],
  [
    "Resolved npm dist shasum for the fetched artifact (if reported by npm).",
    "从拉取到的制品中解析出的 npm dist shasum（如果 npm 有返回）。",
  ],
  ["ISO timestamp of last resolution.", "最近一次解析的 ISO 时间戳。"],
  ["ISO timestamp of last install/update.", "最近一次安装或更新的 ISO 时间戳。"],
]);

const CONFIG_TAG_MAP = new Map<string, string>([
  ["security", "安全"],
  ["auth", "认证"],
  ["network", "网络"],
  ["access", "访问"],
  ["privacy", "隐私"],
  ["observability", "可观测性"],
  ["performance", "性能"],
  ["reliability", "可靠性"],
  ["storage", "存储"],
  ["models", "模型"],
  ["media", "媒体"],
  ["automation", "自动化"],
  ["channels", "频道"],
  ["tools", "工具"],
  ["advanced", "高级"],
]);

const CONFIG_TOKEN_MAP = new Map<string, string>([
  ["Plugin", "插件"],
  ["Plugins", "插件"],
  ["Allowlist", "允许列表"],
  ["Denylist", "拒绝列表"],
  ["Enable", "启用"],
  ["Enabled", "已启用"],
  ["Loader", "加载器"],
  ["Load", "加载"],
  ["Paths", "路径"],
  ["Path", "路径"],
  ["Slots", "槽位"],
  ["Slot", "槽位"],
  ["Memory", "内存"],
  ["Context", "上下文"],
  ["Engine", "引擎"],
  ["Entries", "条目"],
  ["Entry", "条目"],
  ["Hook", "钩子"],
  ["Hooks", "钩子"],
  ["Policy", "策略"],
  ["Prompt", "提示词"],
  ["Injection", "注入"],
  ["API", "API"],
  ["Key", "密钥"],
  ["Environment", "环境"],
  ["Variables", "变量"],
  ["Config", "配置"],
  ["Install", "安装"],
  ["Installs", "安装"],
  ["Records", "记录"],
  ["Record", "记录"],
  ["Source", "来源"],
  ["Spec", "规范"],
  ["Version", "版本"],
  ["Resolved", "解析后的"],
  ["Package", "包"],
  ["Name", "名称"],
  ["Integrity", "完整性"],
  ["Resolution", "解析"],
  ["Time", "时间"],
  ["Settings", "设置"],
  ["All", "全部"],
]);

function isChineseConfigLocale(): boolean {
  return i18n.getLocale().toLowerCase().startsWith("zh");
}

function normalizeConfigText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function localizeConfigPhrase(raw: string): string {
  const normalized = normalizeConfigText(raw);
  const direct = CONFIG_TEXT_MAP.get(normalized);
  if (direct) {
    return direct;
  }
  const tokens = normalized.split(" ");
  if (tokens.length === 0 || !tokens.every((token) => CONFIG_TOKEN_MAP.has(token))) {
    return raw;
  }
  return tokens.map((token) => CONFIG_TOKEN_MAP.get(token) ?? token).join("");
}

export function localizeConfigText(raw?: string): string | undefined {
  if (!raw || !isChineseConfigLocale()) {
    return raw;
  }
  return localizeConfigPhrase(raw);
}

export function localizeConfigTag(raw: string): string {
  if (!isChineseConfigLocale()) {
    return raw;
  }
  return CONFIG_TAG_MAP.get(raw.toLowerCase()) ?? raw;
}

export function localizeConfigStatus(status: "valid" | "invalid" | "unknown"): string {
  if (!isChineseConfigLocale()) {
    return status;
  }
  switch (status) {
    case "valid":
      return "有效";
    case "invalid":
      return "无效";
    default:
      return "未知";
  }
}

export function schemaType(schema: JsonSchema): string | undefined {
  if (!schema) {
    return undefined;
  }
  if (Array.isArray(schema.type)) {
    const filtered = schema.type.filter((t) => t !== "null");
    return filtered[0] ?? schema.type[0];
  }
  return schema.type;
}

export function defaultValue(schema?: JsonSchema): unknown {
  if (!schema) {
    return "";
  }
  if (schema.default !== undefined) {
    return schema.default;
  }
  const type = schemaType(schema);
  switch (type) {
    case "object":
      return {};
    case "array":
      return [];
    case "boolean":
      return false;
    case "number":
    case "integer":
      return 0;
    case "string":
      return "";
    default:
      return "";
  }
}

export function pathKey(path: Array<string | number>): string {
  return path.filter((segment) => typeof segment === "string").join(".");
}

export function hintForPath(path: Array<string | number>, hints: ConfigUiHints) {
  const key = pathKey(path);
  const direct = hints[key];
  if (direct) {
    return direct;
  }
  const segments = key.split(".");
  for (const [hintKey, hint] of Object.entries(hints)) {
    if (!hintKey.includes("*")) {
      continue;
    }
    const hintSegments = hintKey.split(".");
    if (hintSegments.length !== segments.length) {
      continue;
    }
    let match = true;
    for (let i = 0; i < segments.length; i += 1) {
      if (hintSegments[i] !== "*" && hintSegments[i] !== segments[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      return hint;
    }
  }
  return undefined;
}

export function humanize(raw: string) {
  const humanized = raw
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .replace(/^./, (m) => m.toUpperCase());
  return localizeConfigText(humanized) ?? humanized;
}
