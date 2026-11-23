import type { SessionEvent } from "@agentcontrol/protocol";

/** How a session's time divides: the whole span, time the agent worked, time it waited for the user. */
export type TimeFacts = { wallMs: number; workingMs: number; waitingMs: number };

interface Tally {
  turnStart: number | undefined;
  /** When each unanswered permission request was asked, by request id. */
  asked: Map<string, number>;
  turnMs: number;
  waitMs: number;
}

type Handler = (call: { tally: Tally; at: number; event: SessionEvent }) => void;

/** Ends the open turn and every unanswered request at `at`. */
function closeAll(tally: Tally, at: number): void {
  if (tally.turnStart !== undefined) tally.turnMs += at - tally.turnStart;
  for (const askedAt of tally.asked.values()) tally.waitMs += at - askedAt;
  tally.turnStart = undefined;
  tally.asked.clear();
}

const endAll: Handler = ({ tally, at }) => {
  closeAll(tally, at);
};

const handlers = new Map<SessionEvent["kind"], Handler>([
  [
    "prompt-sent",
    ({ tally, at }) => {
      tally.turnStart ??= at;
    },
  ],
  [
    "permission-requested",
    ({ tally, at, event }) => {
      if (event.kind === "permission-requested") tally.asked.set(event.payload.requestId, at);
    },
  ],
  [
    "permission-answered",
    ({ tally, at, event }) => {
      if (event.kind !== "permission-answered") return;
      const askedAt = tally.asked.get(event.payload.requestId);
      if (askedAt !== undefined) tally.waitMs += at - askedAt;
      tally.asked.delete(event.payload.requestId);
    },
  ],
  ["turn-ended", endAll],
  ["agent-exited", endAll],
  ["session-archived", endAll],
]);

/**
 * Time from the events' timestamps. A turn runs from the user's prompt to its end; the part of it
 * that a permission request waited for an answer is waiting, the rest is working. A turn or
 * request still open at the end of the events (the agent died, or the session is live) runs to
 * `liveUntil` when the session is live, else to its last event.
 */
export function timeOfEvents(events: SessionEvent[], liveUntil?: number): TimeFacts {
  const first = events[0];
  const last = events.at(-1);
  if (first === undefined || last === undefined) return { wallMs: 0, workingMs: 0, waitingMs: 0 };
  const lastAt = Date.parse(last.ts);
  const tally = tallyOf(events, Math.max(lastAt, liveUntil ?? lastAt));
  return {
    wallMs: lastAt - Date.parse(first.ts),
    workingMs: Math.max(0, tally.turnMs - tally.waitMs),
    waitingMs: tally.waitMs,
  };
}

/** Runs the events through the handlers, then ends whatever is still open at `endAt`. */
function tallyOf(events: SessionEvent[], endAt: number): Tally {
  const tally: Tally = { turnStart: undefined, asked: new Map(), turnMs: 0, waitMs: 0 };
  for (const event of events) {
    handlers.get(event.kind)?.({ tally, at: Date.parse(event.ts), event });
  }
  closeAll(tally, endAt);
  return tally;
}
