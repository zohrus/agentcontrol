import type { AcpUpdate } from "./acp-updates.ts";
import { itemKey, type ViewState } from "./view-state.ts";

type Update<K extends AcpUpdate["sessionUpdate"]> = Extract<AcpUpdate, { sessionUpdate: K }>;

const compactionTexts: Record<string, string> = {
  in_progress: "Compacting the conversation…",
  completed: "Conversation compacted",
  failed: "Compacting the conversation failed",
  cancelled: "Compacting the conversation was cancelled",
};

/** The agent switched mode: shown as a small "Mode: …" line. */
export function reduceMode(
  state: ViewState,
  update: Update<"current_mode_update">,
  seq: number,
): void {
  state.items.push({ type: "mode", key: itemKey("mode", seq), modeId: update.currentModeId });
}

/** A fire-and-forget message from the agent: shown as a muted line. */
export function reduceAgentNotice(state: ViewState, update: Update<"notice">, seq: number): void {
  const text = update.description ? `${update.title}: ${update.description}` : update.title;
  state.items.push({ type: "notice", key: itemKey("notice", seq), text });
}

/** Context compaction: one muted line that is updated in place as the status changes. */
export function reduceCompaction(state: ViewState, update: Update<"compaction_update">): void {
  const key = itemKey("compaction", update.compactionId);
  const text = compactionTexts[update.status] ?? "Compacting the conversation…";
  const existing = state.items.find((item) => item.type === "notice" && item.key === key);
  if (existing?.type === "notice") existing.text = text;
  else state.items.push({ type: "notice", key, text });
}
