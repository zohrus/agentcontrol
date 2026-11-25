import type { SessionEvent } from "@agentcontrol/protocol";
import { reduceEvent, TURN_EDGES } from "./reduce-events.ts";
import type { ItemOf, ViewItem } from "./view-items.ts";
import { createViewState, type ViewState } from "./view-state.ts";

/** The view state with what it has taken in so far, so new events are folded onto it. */
export type Fold = {
  state: ViewState;
  /** How many events of the history are folded in, and the last of them. */
  consumed: number;
  lastEvent: SessionEvent | undefined;
  /** The last agent start, exit or interruption, to tell an exit that only records a stop. */
  lifecycle: SessionEvent | undefined;
  /** True while a prompt has been sent and its turn has not ended. */
  turnOpen: boolean;
  /** The message or thought flagged as streaming. */
  live: ItemOf<"message" | "thought"> | undefined;
};

export const emptyFold = (): Fold => ({
  state: createViewState(),
  consumed: 0,
  lastEvent: undefined,
  lifecycle: undefined,
  turnOpen: false,
  live: undefined,
});

/** Whether `events` is what the fold took in plus newer events: else it must be built again. */
export function extendsFold(fold: Fold, events: readonly SessionEvent[]): boolean {
  if (fold.lastEvent === undefined) return true;
  if (events[fold.consumed - 1] !== fold.lastEvent) return false;
  const next = events[fold.consumed];
  return next === undefined || next.seq > fold.lastEvent.seq;
}

const LIFECYCLE = new Set(["agent-started", "agent-exited", "agent-interrupted"]);

/** The key of the exit item to take out: an exit without a code right before the interruption. */
function interruptedExitKey(lifecycle: SessionEvent | undefined, event: SessionEvent) {
  if (event.kind !== "agent-interrupted" || lifecycle?.kind !== "agent-exited") return undefined;
  // A crash with an exit code stays visible: only a stop by signal (no code) is the relay's.
  return lifecycle.payload.exitCode === null ? `exit-${String(lifecycle.seq)}` : undefined;
}

/**
 * An exit that only records the relay stopping is not shown: the interruption says it in one
 * line, so the exit already shown is taken out.
 */
function dropInterruptedExit(fold: Fold, event: SessionEvent): void {
  const key = interruptedExitKey(fold.lifecycle, event);
  if (key === undefined) return;
  const at = fold.state.items.findLastIndex((item) => item.key === key);
  if (at >= 0) fold.state.items.splice(at, 1);
}

function foldOne(fold: Fold, event: SessionEvent): void {
  dropInterruptedExit(fold, event);
  reduceEvent(fold.state, event);
  if (LIFECYCLE.has(event.kind)) fold.lifecycle = event;
  if (TURN_EDGES.has(event.kind)) fold.turnOpen = event.kind === "prompt-sent";
  fold.consumed += 1;
  fold.lastEvent = event;
}

/** More events than this in one go are a history loaded (or loaded again), not a stream. */
const MOST_LIVE_EVENTS = 100;

/** Folds the events not folded yet. */
export function foldNew(fold: Fold, events: readonly SessionEvent[]): void {
  const added = events.slice(fold.consumed);
  fold.state.live = fold.consumed > 0 && added.length <= MOST_LIVE_EVENTS;
  for (const event of added) foldOne(fold, event);
}

type Text = ItemOf<"message" | "thought">;

/** The last item, when it is a message or thought of a running turn. */
function streamingItem(fold: Fold): Text | undefined {
  const last = fold.state.items.at(-1);
  return fold.turnOpen && isText(last) ? last : undefined;
}

const isText = (item: ViewItem | undefined): item is Text =>
  item?.type === "message" || item?.type === "thought";

/** Flags the last item as streaming when it is a message or thought of a running turn. */
export function flagStreaming(fold: Fold): void {
  const live = streamingItem(fold);
  if (fold.live !== undefined && fold.live !== live) fold.live.streaming = false;
  if (live !== undefined) live.streaming = true;
  fold.live = live;
}
