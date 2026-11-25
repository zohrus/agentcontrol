import type { SessionEvent } from "@agentcontrol/sdk";
import type { SessionRef } from "./session-ref.ts";
import { keyOf } from "./session-ref.ts";

/** Runs a function once at the next screen frame; returns the function that cancels it. */
export type Frames = (run: () => void) => () => void;

/** A tab that is hidden gets no animation frames: a timer makes sure the events are not held for ever. */
const HIDDEN_TAB_DELAY_MS = 100;

/** The browser's next frame, or the timer when no frame comes (a hidden tab). */
export const browserFrames: Frames = (run) => {
  const frame = requestAnimationFrame(run);
  const timer = setTimeout(run, HIDDEN_TAB_DELAY_MS);
  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
  };
};

type Held = { ref: SessionRef; events: SessionEvent[] };

/** Live events of every session, taken in once per frame. */
export type EventQueue = {
  /** Holds an event until the next frame. */
  add: (ref: SessionRef, event: SessionEvent) => void;
  /** The seq of the last event held for the session, when one is. */
  lastSeq: (ref: SessionRef) => number | undefined;
  /** Hands over everything held now. */
  flush: () => void;
};

/** Collects events and hands them to `take`, all of them together, once per frame. */
export function createEventQueue(call: {
  frames: Frames;
  take: (batches: readonly Held[]) => void;
}): EventQueue {
  const held = new Map<string, Held>();
  let cancel: (() => void) | undefined;
  const flush = (): void => {
    cancel?.();
    cancel = undefined;
    const batches = [...held.values()];
    held.clear();
    if (batches.length > 0) call.take(batches);
  };
  return {
    add: (ref, event) => {
      const entry = held.get(keyOf(ref)) ?? { ref, events: [] };
      entry.events.push(event);
      held.set(keyOf(ref), entry);
      cancel ??= call.frames(flush);
    },
    lastSeq: (ref) => held.get(keyOf(ref))?.events.at(-1)?.seq,
    flush,
  };
}
