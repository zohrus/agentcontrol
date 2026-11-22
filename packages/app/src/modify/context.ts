import type { UiVersions } from "../ui-versions/index.ts";
import type { UiWorkspace } from "../ui-workspace/index.ts";
import type { AgentTurns } from "./agent-turns.ts";
import type { Persist } from "./persist.ts";
import type { Change, ModifyGate, ModifyState, ModifyStatus, ModifyUpdate } from "./types.ts";

const GATES: Record<ModifyStatus, ModifyGate> = {
  idle: "idle",
  working: "idle",
  checking: "checking",
  fixing: "checking",
  ready: "ready",
  failed: "failed",
};

/** What the Modify agent works with; built once by `createModify`. */
interface Deps {
  workspace: UiWorkspace;
  versions: UiVersions;
  turns: AgentTurns;
  /** Shows a new state to everyone who listens (the SSE stream). */
  publish: (state: ModifyState) => void;
  /** Remembers a change that waits for Keep or Undo across app restarts; forgets it otherwise. */
  persist: Persist;
}

export interface Ctx extends Deps {
  state: ModifyState;
  change: Change;
  /** The default-UI version waiting to be merged, if any. */
  available: string | undefined;
  /** True while Keep, Undo, Discard or Restore is running. */
  finishing: boolean;
}

export const NO_CHANGE: Change = {
  kind: "change",
  requests: [],
  preface: "",
  title: "",
  generation: 0,
};

type Fields = Partial<Omit<ModifyState, "status" | "gate">>;

function updateOf(ctx: Ctx, status: ModifyStatus): ModifyUpdate | undefined {
  const { merge } = ctx.change;
  if (merge && status === "ready") return { phase: "merged", ...merge };
  return ctx.available === undefined ? undefined : { phase: "available", version: ctx.available };
}

function publishState(ctx: Ctx, state: ModifyState): void {
  ctx.state = state;
  ctx.persist.save(state, ctx.change);
  ctx.publish(state);
}

/** Moves to a new status. The request, session and update carry over; the rest is what is given. */
export function show(ctx: Ctx, status: ModifyStatus, fields: Fields = {}): void {
  const { request } = ctx.state;
  const sessionId = ctx.turns.sessionId();
  const update = updateOf(ctx, status);
  publishState(ctx, {
    changedFiles: [],
    ...(request === undefined ? {} : { request }),
    ...(sessionId === undefined ? {} : { sessionId }),
    ...(update === undefined ? {} : { update }),
    ...fields,
    status,
    gate: GATES[status],
  });
}

/** Back to nothing in progress. The last session stays, so its chat can still be read. */
export function showIdle(ctx: Ctx): void {
  const sessionId = ctx.turns.sessionId();
  const update = updateOf(ctx, "idle");
  publishState(ctx, {
    status: "idle",
    gate: "idle",
    changedFiles: [],
    ...(sessionId === undefined ? {} : { sessionId }),
    ...(update === undefined ? {} : { update }),
  });
}

/** Publishes the state again, for a fact that arrived on its own: the agent session just started. */
export function refresh(ctx: Ctx): void {
  const sessionId = ctx.turns.sessionId();
  publishState(ctx, { ...ctx.state, ...(sessionId === undefined ? {} : { sessionId }) });
}

/** After a restart: shows the change that was waiting for Keep or Undo, or nothing in progress. */
export function restoreWaiting(ctx: Ctx): void {
  const saved = ctx.persist.load();
  if (!saved) {
    showIdle(ctx);
    return;
  }
  ctx.change = { ...saved.change, preface: "", generation: ctx.change.generation + 1 };
  const state = { ...saved.state };
  delete state.sessionId;
  publishState(ctx, state);
}

/** Starts a fresh change; the old one's rounds, if any, see the new generation and stop. */
export function startChange(ctx: Ctx, change: Omit<Change, "generation">): void {
  ctx.change = { ...change, generation: ctx.change.generation + 1 };
}

/** True when this change was discarded or replaced while a step of it was still running. */
export const isStale = (ctx: Ctx, generation: number): boolean =>
  ctx.change.generation !== generation;
