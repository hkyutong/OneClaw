import type { ConfigUiHint, ConfigUiHints } from "../types.ts";

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
  ["OpenClawConfig", "OneClaw 配置"],
  ["OneClawConfig", "OneClaw 配置"],
  ["Settings", "设置"],
  ["Config", "配置"],
  ["Search settings...", "搜索设置..."],
  ["Tag Filters:", "标签筛选："],
  ["Add tags", "添加标签"],
  ["All Settings", "全部设置"],
  ["No changes", "没有更改"],
  ["Reload", "重新加载"],
  ["Save", "保存"],
  ["Apply", "应用"],
  ["Update", "更新"],
  ["Form", "表单"],
  ["Raw", "原始"],
  ["Review pending changes", "查看待提交更改"],
  ["Loading schema...", "正在加载 schema…"],
  ["Raw JSON5", "原始 JSON5"],
  ["Please select...", "请选择..."],
  ["Add", "添加"],
  ["Add entry", "添加条目"],
  ["Remove item", "移除此项"],
  ["Key", "键名"],
  ["JSON value", "JSON 值"],
  ["Custom entries", "自定义条目"],
  ["No custom entries.", "暂无自定义条目。"],
  ["No entries yet. Click “Add” to create one.", "暂时没有条目。点击“添加”即可创建。"],
  ["No settings available in this section", "当前分区没有可显示的设置"],
  ["No settings match", "没有与"],
  ["Default value:", "默认值："],
  ["Reset to default", "重置为默认值"],
  [
    "Safe form editing is unavailable for some fields. Switch to raw mode to avoid losing config.",
    "表单视图无法安全编辑部分字段。请改用原始模式，避免丢失配置项。",
  ],
  ["Config schema is currently unavailable.", "配置结构暂不可用。"],
  [
    "This config shape is not supported in form mode right now. Switch to raw mode.",
    "当前配置结构暂不支持表单编辑，请切换到原始模式。",
  ],
  ["item", "项"],
  ["items", "项"],
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
  ["secret", "机密"],
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
  ["Gateway", "网关"],
  ["Auth", "认证"],
  ["Token", "令牌"],
  ["Tokens", "令牌"],
  ["Password", "密码"],
  ["Mode", "模式"],
  ["Modes", "模式"],
  ["Bind", "绑定"],
  ["Port", "端口"],
  ["Ports", "端口"],
  ["Host", "主机"],
  ["Hosts", "主机"],
  ["Proxy", "代理"],
  ["Proxies", "代理"],
  ["Header", "请求头"],
  ["Headers", "请求头"],
  ["Origin", "来源"],
  ["Origins", "来源"],
  ["Allowed", "允许"],
  ["Allow", "允许"],
  ["Denied", "拒绝"],
  ["Deny", "拒绝"],
  ["From", "来源"],
  ["To", "目标"],
  ["Default", "默认"],
  ["Session", "会话"],
  ["Sessions", "会话"],
  ["Channel", "频道"],
  ["Channels", "频道"],
  ["Message", "消息"],
  ["Messages", "消息"],
  ["Agent", "代理"],
  ["Agents", "代理"],
  ["Skill", "技能"],
  ["Skills", "技能"],
  ["Tool", "工具"],
  ["Tools", "工具"],
  ["Node", "节点"],
  ["Nodes", "节点"],
  ["Browser", "浏览器"],
  ["Browsers", "浏览器"],
  ["Web", "网页"],
  ["Media", "媒体"],
  ["Audio", "音频"],
  ["Model", "模型"],
  ["Models", "模型"],
  ["Provider", "提供商"],
  ["Providers", "提供商"],
  ["Runtime", "运行时"],
  ["Workspace", "工作区"],
  ["Command", "命令"],
  ["Commands", "命令"],
  ["Cron", "定时任务"],
  ["Job", "任务"],
  ["Jobs", "任务"],
  ["Status", "状态"],
  ["Health", "健康"],
  ["Local", "本地"],
  ["Remote", "远程"],
  ["Timeout", "超时"],
  ["Interval", "间隔"],
  ["Verbose", "详细输出"],
  ["Reasoning", "推理"],
  ["Thinking", "思考"],
  ["File", "文件"],
  ["Files", "文件"],
  ["UI", "界面"],
  ["Id", "ID"],
  ["IDs", "ID"],
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

const CONFIG_VALUE_MAP = new Map<string, string>([
  ["valid", "有效"],
  ["invalid", "无效"],
  ["unknown", "未知"],
  ["none", "无"],
  ["default", "默认"],
  ["inherit", "继承"],
  ["custom", "自定义"],
  ["all", "全部"],
  ["off", "关闭"],
  ["on", "开启"],
  ["enabled", "已启用"],
  ["disabled", "已禁用"],
  ["true", "是"],
  ["false", "否"],
  ["auto", "自动"],
  ["loopback", "仅本机"],
  ["lan", "局域网"],
  ["tailnet", "Tailscale 网络"],
  ["allow", "允许"],
  ["deny", "拒绝"],
  ["allowlist", "允许列表"],
  ["denylist", "拒绝列表"],
  ["full", "完全放行"],
  ["on-miss", "未命中时询问"],
  ["always", "始终询问"],
  ["token", "令牌"],
  ["password", "密码"],
  ["main", "主会话"],
  ["isolated", "隔离会话"],
  ["announce", "发布摘要"],
  ["webhook", "Webhook 回调"],
  ["internal", "内部"],
]);

const CONFIG_TEXT_LOOKUP = new Map<string, string>(
  Array.from(CONFIG_TEXT_MAP.entries(), ([key, value]) => [key.toLowerCase(), value]),
);

const CONFIG_TOKEN_LOOKUP = new Map<string, string>(
  Array.from(CONFIG_TOKEN_MAP.entries(), ([key, value]) => [key.toLowerCase(), value]),
);

function isChineseConfigLocale(): boolean {
  const activeLocale = i18n.getLocale().toLowerCase();
  if (activeLocale.startsWith("zh")) {
    return true;
  }
  if (typeof document !== "undefined") {
    const documentLocale = document.documentElement.lang?.toLowerCase().trim();
    if (documentLocale?.startsWith("zh")) {
      return true;
    }
  }
  return false;
}

function normalizeConfigText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function localizeConfigPhrase(raw: string): string {
  const normalized = normalizeConfigText(raw);
  const itemCount = normalized.match(/^(\d+)\s+items?$/i);
  if (itemCount) {
    return `${itemCount[1]} 项`;
  }
  const direct = CONFIG_TEXT_MAP.get(normalized);
  if (direct) {
    return direct;
  }
  const lowerDirect = CONFIG_TEXT_LOOKUP.get(normalized.toLowerCase());
  if (lowerDirect) {
    return lowerDirect;
  }
  const tokens = normalized.split(" ");
  if (
    tokens.length === 0 ||
    !tokens.every(
      (token) => CONFIG_TOKEN_MAP.has(token) || CONFIG_TOKEN_LOOKUP.has(token.toLowerCase()),
    )
  ) {
    return raw;
  }
  return tokens
    .map(
      (token) =>
        CONFIG_TOKEN_MAP.get(token) ?? CONFIG_TOKEN_LOOKUP.get(token.toLowerCase()) ?? token,
    )
    .join("");
}

export function localizeConfigText(raw?: string): string | undefined {
  if (!raw || !isChineseConfigLocale()) {
    return raw;
  }
  return localizeConfigPhrase(raw);
}

export function localizeConfigCount(count: number, noun: "item" | "change"): string {
  if (!isChineseConfigLocale()) {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
  }
  return noun === "change" ? `${count} 处更改` : `${count} 项`;
}

export function formatConfigNoMatchMessage(query: string): string {
  if (!isChineseConfigLocale()) {
    return `No settings match “${query}”`;
  }
  return `没有与 “${query}” 匹配的设置`;
}

export function localizeConfigValue(raw: unknown): string {
  if (!isChineseConfigLocale()) {
    return String(raw);
  }
  if (typeof raw === "boolean") {
    return raw ? "是" : "否";
  }
  if (typeof raw === "number") {
    return String(raw);
  }
  if (typeof raw !== "string") {
    return String(raw);
  }
  const normalized = raw.trim();
  if (!normalized) {
    return normalized;
  }
  const direct = CONFIG_VALUE_MAP.get(normalized.toLowerCase());
  if (direct) {
    return direct;
  }
  return localizeConfigText(normalized) ?? normalized;
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

const SENSITIVE_KEY_WHITELIST_SUFFIXES = [
  "maxtokens",
  "maxoutputtokens",
  "maxinputtokens",
  "maxcompletiontokens",
  "contexttokens",
  "totaltokens",
  "tokencount",
  "tokenlimit",
  "tokenbudget",
  "passwordfile",
] as const;

const SENSITIVE_PATTERNS = [
  /token$/i,
  /password/i,
  /secret/i,
  /api.?key/i,
  /serviceaccount(?:ref)?$/i,
];

const ENV_VAR_PLACEHOLDER_PATTERN = /^\$\{[^}]*\}$/;

export const REDACTED_PLACEHOLDER = "[redacted - click reveal to view]";

function isEnvVarPlaceholder(value: string): boolean {
  return ENV_VAR_PLACEHOLDER_PATTERN.test(value.trim());
}

export function isSensitiveConfigPath(path: string): boolean {
  const lowerPath = path.toLowerCase();
  const whitelisted = SENSITIVE_KEY_WHITELIST_SUFFIXES.some((suffix) => lowerPath.endsWith(suffix));
  return !whitelisted && SENSITIVE_PATTERNS.some((pattern) => pattern.test(path));
}

function isSensitiveLeafValue(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0 && !isEnvVarPlaceholder(value);
  }
  return value !== undefined && value !== null;
}

function isHintSensitive(hint: ConfigUiHint | undefined): boolean {
  return hint?.sensitive ?? false;
}

export function hasSensitiveConfigData(
  value: unknown,
  path: Array<string | number>,
  hints: ConfigUiHints,
): boolean {
  const key = pathKey(path);
  const hint = hintForPath(path, hints);
  const pathIsSensitive = isHintSensitive(hint) || isSensitiveConfigPath(key);

  if (pathIsSensitive && isSensitiveLeafValue(value)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((item, index) => hasSensitiveConfigData(item, [...path, index], hints));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(([childKey, childValue]) =>
      hasSensitiveConfigData(childValue, [...path, childKey], hints),
    );
  }

  return false;
}

export function countSensitiveConfigValues(
  value: unknown,
  path: Array<string | number>,
  hints: ConfigUiHints,
): number {
  if (value == null) {
    return 0;
  }

  const key = pathKey(path);
  const hint = hintForPath(path, hints);
  const pathIsSensitive = isHintSensitive(hint) || isSensitiveConfigPath(key);

  if (pathIsSensitive && isSensitiveLeafValue(value)) {
    return 1;
  }

  if (Array.isArray(value)) {
    return value.reduce(
      (count, item, index) => count + countSensitiveConfigValues(item, [...path, index], hints),
      0,
    );
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce(
      (count, [childKey, childValue]) =>
        count + countSensitiveConfigValues(childValue, [...path, childKey], hints),
      0,
    );
  }

  return 0;
}
