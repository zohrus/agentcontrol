import type { SessionEvent } from "@agentcontrol/protocol";
import { groupTools } from "./group-tools.ts";
import { applyUpdate } from "./reduce-updates.ts";
import { reducePermissionAnswered, reducePermissionRequested } from "./reduce-permission.ts";
import { reduceSetupFinished, reduceSetupOutput } from "./reduce-setup.ts";
import type { ViewItem } from "./view-items.ts";
import { addChunk, itemKey, type ViewState } from "./view-state.ts";

type EventMap = { [E in SessionEvent as E["kind"]]: E };
type Reducers = { [K in keyof EventMap]: (state: ViewState, event: EventMap[K]) => void };

function ignore(): void {}

/** One small reducer per relay event kind. */
const reducers: Reducers = {
  acp: (state, { seq, payload }) => {
    for (const update of payload.updates ?? []) applyUpdate(state, update, seq);
  },
  "session-created": ignore,
  "agent-started": ignore,
  "setup-output": reduceSetupOutput,
  "setup-finished": reduceSetupFinished,
  "agent-exited": (state, { seq, payload }) => {
    const { exitCode, signal } = payload;
    state.items.push({ type: "agent-exited", key: itemKey("exit", seq), exitCode, signal });
  },
  "permission-requested": reducePermissionRequested,
  "permission-answered": reducePermissionAnswered,
  "prompt-sent": (state, { seq, payload }) => {
    const chunk = { type: "user" as const, key: itemKey("user", seq), text: payload.text };
    addChunk(state, { ...chunk, messageId: itemKey("prompt", seq) });
  },
  "turn-ended": (state, { seq, payload }) => {
    state.items.push({
      type: "turn-ended",
      key: itemKey("turn", seq),
      stopReason: payload.stopReason,
    });
  },
  "session-archived": (state, { seq }) => {
    state.items.push({ type: "notice", key: itemKey("archived", seq), text: "Session archived" });
  },
};

function dispatch<K extends keyof EventMap>(state: ViewState, kind: K, event: EventMap[K]): void {
  reducers[kind](state, event);
}

/** Reduces the relay event log to the items the stream shows. Pure. */
export function buildViewItems(events: readonly SessionEvent[]): ViewItem[] {
  const state: ViewState = { items: [] };
  for (const event of events) dispatch(state, event.kind, event);
  return groupTools(state.items);
}

/** True while a prompt has been sent and its turn has not ended. */
export function isTurnRunning(events: readonly SessionEvent[]): boolean {
  const last = events.findLast((e) =>
    ["prompt-sent", "turn-ended", "agent-exited"].includes(e.kind),
  );
  return last?.kind === "prompt-sent";
}
