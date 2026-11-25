import type { SessionEvent } from "@agentcontrol/protocol";
import { applyUpdate } from "./reduce-updates.ts";
import { reducePermissionAnswered, reducePermissionRequested } from "./reduce-permission.ts";
import { reduceArchived, reduceSetupFinished, reduceSetupOutput } from "./reduce-setup.ts";
import { addChunk, itemKey, type ViewState } from "./view-state.ts";

type EventMap = { [E in SessionEvent as E["kind"]]: E };
type Reducers = { [K in keyof EventMap]: (state: ViewState, event: EventMap[K]) => void };

function ignore(): void {}

/** One small reducer per relay event kind. */
const reducers: Reducers = {
  acp: (state, { seq, payload }) => {
    for (const update of payload.updates ?? []) applyUpdate(state, update, seq);
  },
  "session-created": (state, { payload }) => {
    state.root = payload.worktreePath;
  },
  "agent-started": ignore,
  "base-resolved": ignore,
  "setup-output": reduceSetupOutput,
  "setup-finished": reduceSetupFinished,
  "agent-exited": (state, { seq, payload }) => {
    const { exitCode, signal } = payload;
    state.items.push({ type: "agent-exited", key: itemKey("exit", seq), exitCode, signal });
  },
  "agent-interrupted": (state, { seq, payload }) => {
    const dropped = payload.droppedRequests;
    const waiting = dropped === 0 ? "" : ` ${String(dropped)} waiting request(s) were dropped.`;
    const text = `The agent was interrupted when the relay stopped.${waiting}`;
    state.items.push({ type: "notice", key: itemKey("interrupted", seq), text });
  },
  "session-resumed": (state, { seq, payload }) => {
    state.items.push({ type: "notice", key: itemKey("resumed", seq), text: payload.note });
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
  "session-archived": (state, event) => {
    reduceArchived(state, event);
    const key = itemKey("archived", event.seq);
    state.items.push({ type: "notice", key, text: "Session archived" });
  },
};

function dispatch<K extends keyof EventMap>(state: ViewState, kind: K, event: EventMap[K]): void {
  reducers[kind](state, event);
}

/** Applies one relay event to the view state. */
export function reduceEvent(state: ViewState, event: SessionEvent): void {
  dispatch(state, event.kind, event);
}

/** The events that open or close a turn: the last of them says whether one is running. */
export const TURN_EDGES = new Set([
  "prompt-sent",
  "turn-ended",
  "agent-exited",
  "agent-interrupted",
]);

/** True while a prompt has been sent and its turn has not ended. */
export function isTurnRunning(events: readonly SessionEvent[]): boolean {
  return events.findLast((e) => TURN_EDGES.has(e.kind))?.kind === "prompt-sent";
}
