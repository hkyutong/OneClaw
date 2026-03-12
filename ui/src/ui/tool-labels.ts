/**
 * Map raw tool names to human-friendly labels for the chat UI.
 * Unknown tools are title-cased with underscores replaced by spaces.
 */

export const TOOL_LABELS: Record<string, string> = {
  exec: "运行命令",
  bash: "运行命令",
  read: "读取文件",
  write: "写入文件",
  edit: "编辑文件",
  apply_patch: "应用补丁",
  web_search: "网页搜索",
  web_fetch: "抓取网页",
  browser: "浏览器",
  message: "发送消息",
  image: "生成图片",
  canvas: "画布",
  cron: "定时任务",
  gateway: "网关",
  nodes: "节点",
  memory_search: "搜索记忆",
  memory_get: "读取记忆",
  session_status: "会话状态",
  sessions_list: "会话列表",
  sessions_history: "会话历史",
  sessions_send: "发送到会话",
  sessions_spawn: "创建会话",
  agents_list: "代理列表",
};

export function friendlyToolName(raw: string): string {
  const mapped = TOOL_LABELS[raw];
  if (mapped) {
    return mapped;
  }
  return raw.replace(/_/g, " ");
}
