import type { SessionEvent, SessionId } from "@agentcontrol/protocol";
import { listLogged, scanEvents, sessionFile } from "./files.ts";
import type { EventInput } from "./types.ts";
import { createWriter } from "./writer.ts";

export type { EventInput };

export interface EventLog {
  /** Appends one event to the session's JSONL file, assigning seq (per session, from 1) and ts. */
  append(sessionId: SessionId, input: EventInput): Promise<SessionEvent>;
  /** Events of one session with seq > afterSeq, in order. */
  readAfter(sessionId: SessionId, afterSeq: number): Promise<SessionEvent[]>;
  /** Every session that has a log on disk. */
  listSessionIds(): Promise<SessionId[]>;
  /** Last assigned seq for the session, 0 if none. */
  lastSeq(sessionId: SessionId): Promise<number>;
  /** Calls the listener for every event appended from now on; returns an unsubscribe function. */
  subscribe(listener: (event: SessionEvent) => void): () => void;
}

async function collectAfter(file: string, afterSeq: number): Promise<SessionEvent[]> {
  const events: SessionEvent[] = [];
  for await (const event of scanEvents(file)) if (event.seq > afterSeq) events.push(event);
  return events;
}

export function createEventLog(options: { dir: string; now: () => Date }): EventLog {
  const { dir } = options;
  const writer = createWriter(options);
  return {
    append: (sessionId, input) => writer.append(sessionId, input),
    readAfter: (sessionId, afterSeq) =>
      writer.whenIdle(sessionId, () => collectAfter(sessionFile(dir, sessionId), afterSeq)),
    listSessionIds: () => listLogged(dir),
    lastSeq: (sessionId) => writer.lastSeq(sessionId),
    subscribe: (listener) => writer.subscribe(listener),
  };
}
