import type {
  EventsSubscribeParams,
  SessionEvent,
  SessionId,
  SessionSummary,
} from "@agentcontrol/protocol";
import type { z } from "zod";
import { withNormalised } from "../acp-normalise/index.ts";
import type { EventLog } from "../event-log/index.ts";
import type { LiveSummaries } from "./live-summaries.ts";

type SubscribeParams = z.infer<typeof EventsSubscribeParams>;

/** Which sessions to follow, and the last seq the client already has for each. */
function cursorsOf(params: SubscribeParams): { only?: SessionId; seen: Map<SessionId, number> } {
  if ("sessionId" in params) {
    return { only: params.sessionId, seen: new Map([[params.sessionId, params.afterSeq]]) };
  }
  return { seen: new Map(Object.entries(params.afterSeq) as [SessionId, number][]) };
}

/**
 * Replays the log after the client's cursors, then streams new events, with no gap and no repeat.
 * Live events that arrive during the replay wait in a buffer; the cursor drops any that the replay
 * already covered.
 */
export async function followEvents(options: {
  log: EventLog;
  params: SubscribeParams;
  send: (event: SessionEvent) => void;
}): Promise<() => void> {
  const { log, send } = options;
  const { only, seen } = cursorsOf(options.params);
  const deliver = (event: SessionEvent): void => {
    if (event.seq <= (seen.get(event.sessionId) ?? 0)) return;
    seen.set(event.sessionId, event.seq);
    send(withNormalised(event));
  };
  const buffered: SessionEvent[] = [];
  let replaying = true;
  const unsubscribe = log.subscribe((event) => {
    if (only !== undefined && event.sessionId !== only) return;
    if (replaying) buffered.push(event);
    else deliver(event);
  });
  const ids = only === undefined ? await log.listSessionIds() : [only];
  for (const id of ids) {
    for (const event of await log.readAfter(id, seen.get(id) ?? 0)) deliver(event);
  }
  buffered.forEach(deliver);
  replaying = false;
  return unsubscribe;
}

/** Sends the summaries that change from now on, only the session's own when `sessionId` is set. */
export function followSummaries(options: {
  summaries: LiveSummaries;
  sessionId: SessionId | undefined;
  send: (summaries: SessionSummary[]) => void;
}): () => void {
  const { sessionId, send } = options;
  return options.summaries.onChanged((changed) => {
    const wanted = sessionId === undefined ? changed : changed.filter((s) => s.id === sessionId);
    if (wanted.length > 0) send(wanted);
  });
}
