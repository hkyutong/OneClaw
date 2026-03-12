import type { GatewayBrowserClient } from "../gateway.ts";
import type { PresenceEntry } from "../types.ts";

export type PresenceState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  presenceLoading: boolean;
  presenceEntries: PresenceEntry[];
  presenceError: string | null;
  presenceStatus: string | null;
};

function formatPresenceError(err: unknown): string {
  return `加载在线状态失败：${String(err)}`;
}

export async function loadPresence(state: PresenceState) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.presenceLoading) {
    return;
  }
  state.presenceLoading = true;
  state.presenceError = null;
  state.presenceStatus = null;
  try {
    const res = await state.client.request("system-presence", {});
    if (Array.isArray(res)) {
      state.presenceEntries = res;
      state.presenceStatus = res.length === 0 ? "暂时没有在线实例。" : null;
    } else {
      state.presenceEntries = [];
      state.presenceStatus = "没有收到在线状态数据。";
    }
  } catch (err) {
    state.presenceError = formatPresenceError(err);
  } finally {
    state.presenceLoading = false;
  }
}
