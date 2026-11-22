import type { AgentUpdate } from "@agentcontrol/protocol";
import { itemKey, type ViewState } from "./view-state.ts";

type Update<K extends AgentUpdate["type"]> = Extract<AgentUpdate, { type: K }>;

/** The agent switched mode: shown as a small "Mode: …" line. */
export function reduceMode(state: ViewState, update: Update<"mode-changed">, seq: number): void {
  state.items.push({ type: "mode", key: itemKey("mode", seq), modeId: update.modeId });
}

/** A fire-and-forget message from the agent: shown as a muted line. */
export function reduceNotice(state: ViewState, update: Update<"notice">, seq: number): void {
  state.items.push({ type: "notice", key: itemKey("notice", seq), text: update.text });
}
