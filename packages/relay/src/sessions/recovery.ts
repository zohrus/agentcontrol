import type { SessionEvent, SessionId } from "@agentcontrol/protocol";
import type { EventLog } from "../event-log/index.ts";

const STOPPED = "the relay stopped";
const LIFECYCLE = ["agent-started", "agent-exited", "agent-interrupted"];

/** The latest of agent-started, agent-exited and agent-interrupted: what became of the agent last. */
function lastLifecycle(events: SessionEvent[]): SessionEvent | undefined {
  return events.findLast((event) => LIFECYCLE.includes(event.kind));
}

/**
 * The agent's life ended with the relay's: it was still started (the relay died), or the relay's
 * SIGTERM stopped it and the relay died before it marked the session interrupted.
 */
function endedWithTheRelay(events: SessionEvent[]): boolean {
  const last = lastLifecycle(events);
  if (last?.kind === "agent-started") return true;
  return last?.kind === "agent-exited" && last.payload.signal === "SIGTERM";
}

/** Requests the log shows asked and never answered, also when the agent has exited since. */
function unansweredRequests(events: SessionEvent[]): string[] {
  const answered = new Set<string>();
  for (const event of events) {
    if (event.kind === "permission-answered") answered.add(event.payload.requestId);
  }
  return events.flatMap((event) =>
    event.kind === "permission-requested" && !answered.has(event.payload.requestId)
      ? [event.payload.requestId]
      : [],
  );
}

/** The timestamp of the log's last event, to date what the relay writes about its dead self. */
function datedAtTheLastEvent(events: SessionEvent[]): { ts?: string } {
  const ts = events.at(-1)?.ts;
  return ts === undefined ? {} : { ts };
}

/** An agent that died with the relay never reported its exit: record it. */
async function recordExitOfDeadAgent(
  log: EventLog,
  call: { sessionId: SessionId; events: SessionEvent[]; dated: { ts?: string } },
): Promise<void> {
  if (lastLifecycle(call.events)?.kind !== "agent-started") return;
  const exit = { kind: "agent-exited" as const, payload: { exitCode: null }, ...call.dated };
  await log.append(call.sessionId, exit);
}

/**
 * Marks the session interrupted: its agent is gone because the relay stopped. An agent that died
 * with the relay never reported its exit, so that is recorded first (the time and Modify readers
 * of the log look for it), dated at the log's last event: the relay may have been down for days,
 * and that time is neither the agent's work nor a wait for the user. Requests the agent was
 * waiting on are answered as cancelled, with the reason, and counted in the event.
 */
export async function interruptSession(log: EventLog, sessionId: SessionId): Promise<void> {
  const events = await log.readAfter(sessionId, 0);
  const dated = datedAtTheLastEvent(events);
  await recordExitOfDeadAgent(log, { sessionId, events, dated });
  const unanswered = unansweredRequests(events);
  for (const requestId of unanswered) {
    const payload = { requestId, cancelled: true as const, automatic: { reason: STOPPED } };
    await log.append(sessionId, { kind: "permission-answered", payload, ...dated });
  }
  await log.append(sessionId, {
    kind: "agent-interrupted",
    payload: { droppedRequests: unanswered.length },
  });
}

async function recoverSession(log: EventLog, sessionId: SessionId): Promise<void> {
  const events = await log.readAfter(sessionId, 0);
  const kinds = events.map((event) => event.kind);
  if (endedWithTheRelay(events) && !kinds.includes("session-archived")) {
    await interruptSession(log, sessionId);
  }
  if (kinds.includes("session-created") && !kinds.includes("setup-finished")) {
    await log.append(sessionId, { kind: "setup-finished", payload: { exitCode: 1 } });
  }
}

/** After a restart, closes what the dead process left open: agents are gone, setups interrupted. */
export async function recoverSessions(log: EventLog): Promise<SessionId[]> {
  const ids = await log.listSessionIds();
  for (const sessionId of ids) await recoverSession(log, sessionId);
  return ids;
}
