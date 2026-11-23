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
  "session-created": (state, { payload }) => {
    state.root = payload.worktreePath;
  },
  "agent-started": ignore,
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
  "session-archived": (state, { seq }) => {
    state.items.push({ type: "notice", key: itemKey("archived", seq), text: "Session archived" });
  },
};

function dispatch<K extends keyof EventMap>(state: ViewState, kind: K, event: EventMap[K]): void {
  reducers[kind](state, event);
}

const LIFECYCLE = ["agent-started", "agent-exited", "agent-interrupted"];

/**
 * Without the exits that only record the relay stopping: the interruption says it in one line, so
 * an exit whose next lifecycle event is the interruption (the stop's signal, or the exit the relay
 * wrote for an agent that died with it) is not shown as a second line.
 */
function withoutInterruptedExits(events: readonly SessionEvent[]): SessionEvent[] {
  let next: string | undefined;
  const kept = events.toReversed().filter((event) => {
    const hidden = event.kind === "agent-exited" && next === "agent-interrupted";
    if (LIFECYCLE.includes(event.kind)) next = event.kind;
    return !hidden;
  });
  return kept.toReversed();
}

/** Reduces the relay event log to the items the stream shows. Pure. */
export function buildViewItems(events: readonly SessionEvent[]): ViewItem[] {
  const state: ViewState = { items: [] };
  for (const event of withoutInterruptedExits(events)) dispatch(state, event.kind, event);
  return groupTools(state.items);
}

/** True while a prompt has been sent and its turn has not ended. */
export function isTurnRunning(events: readonly SessionEvent[]): boolean {
  const last = events.findLast((e) =>
    ["prompt-sent", "turn-ended", "agent-exited", "agent-interrupted"].includes(e.kind),
  );
  return last?.kind === "prompt-sent";
}
