import type { SessionEvent, SessionId, SessionSummary } from "@agentcontrol/protocol";
import type { EventLog } from "../event-log/index.ts";
import { applyEvent, type EventOf, emptyFold, type Fold } from "./fold.ts";
import { summaryOf } from "./summarize.ts";

type Listener = (summaries: SessionSummary[]) => void;

/** The relay's one copy of every session's derived state, kept current as events are appended. */
export interface LiveSummaries {
  /** The session's summary right now, or undefined for a session that does not exist. */
  summary(sessionId: SessionId): SessionSummary | undefined;
  /** The session's `session-created` event: where it lives. Undefined for an unknown session. */
  created(sessionId: SessionId): EventOf<"session-created"> | undefined;
  /** Every session's summary, oldest first. */
  list(): SessionSummary[];
  /**
   * Calls the listener with the summaries that changed, after the event that changed them has been
   * appended and applied. Changes made in the same event-loop turn arrive together, one per session.
   * Appending events that carry no news (agent output) does not notify. Returns how to stop.
   */
  onChanged(listener: Listener): () => void;
}

/** Equal but for `lastSeq`, which moves with every event and would make every event a change. */
function sameNews(a: SessionSummary | undefined, b: SessionSummary): boolean {
  return a !== undefined && Bun.deepEquals({ ...a, lastSeq: 0 }, { ...b, lastSeq: 0 });
}

async function foldLog(log: EventLog, sessionId: SessionId): Promise<Fold> {
  return (await log.readAfter(sessionId, 0)).reduce(applyEvent, emptyFold);
}

interface State {
  folds: Map<SessionId, Fold>;
  summaries: Map<SessionId, SessionSummary>;
  /** Sessions whose news has not been announced yet. */
  changed: Set<SessionId>;
  listeners: Set<Listener>;
}

function announce(state: State): void {
  const summaries = [...state.changed]
    .map((id) => state.summaries.get(id))
    .filter((summary) => summary !== undefined);
  state.changed.clear();
  for (const listener of [...state.listeners]) {
    try {
      listener(summaries);
    } catch {
      // A faulty listener must not stop the others from hearing the news.
    }
  }
}

function apply(state: State, event: SessionEvent): void {
  const fold = applyEvent(state.folds.get(event.sessionId) ?? emptyFold, event);
  state.folds.set(event.sessionId, fold);
  const summary = summaryOf(fold);
  if (!summary) return;
  const news = !sameNews(state.summaries.get(event.sessionId), summary);
  state.summaries.set(event.sessionId, summary);
  if (!news) return;
  if (state.changed.size === 0) {
    setImmediate(() => {
      announce(state);
    });
  }
  state.changed.add(event.sessionId);
}

/** Folds every log once. */
async function buildState(log: EventLog, sessionIds: SessionId[]): Promise<State> {
  const state: State = {
    folds: new Map(),
    summaries: new Map(),
    changed: new Set(),
    listeners: new Set(),
  };
  for (const id of sessionIds) {
    const fold = await foldLog(log, id);
    state.folds.set(id, fold);
    const summary = summaryOf(fold);
    if (summary) state.summaries.set(id, summary);
  }
  return state;
}

/**
 * Folds the logs of `sessionIds` once, then keeps the result current from the log's appends. After
 * this, nothing needs to read a log to know a session's status, location or pending requests.
 */
export async function createLiveSummaries(options: {
  log: EventLog;
  sessionIds: SessionId[];
}): Promise<LiveSummaries> {
  const { log } = options;
  const state = await buildState(log, options.sessionIds);
  log.subscribe((event) => {
    apply(state, event);
  });
  return {
    summary: (id) => state.summaries.get(id),
    created: (id) => state.folds.get(id)?.created,
    list: () =>
      [...state.summaries.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    onChanged: (listener) => {
      state.listeners.add(listener);
      return () => {
        state.listeners.delete(listener);
      };
    },
  };
}
