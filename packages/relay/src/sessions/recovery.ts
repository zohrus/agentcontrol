import type { SessionEvent, SessionId } from "@agentcontrol/protocol";
import type { EventLog } from "../event-log/index.ts";

const STOPPED = "the relay stopped";
const LIFECYCLE = ["agent-started", "agent-exited", "agent-interrupted"];

/** The latest of agent-started, agent-exited and agent-interrupted: what became of the agent last. */
function lastLifecycle(events: SessionEvent[]): string | undefined {
  return events.findLast((event) => LIFECYCLE.includes(event.kind))?.kind;
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

/**
 * Marks the session interrupted: its agent is gone because the relay stopped. An agent that died
 * with the relay never reported its exit, so that is recorded first (the time and Modify readers
 * of the log look for it). Requests the agent was waiting on are answered as cancelled, with the
 * reason, and counted in the event.
 */
export async function interruptSession(log: EventLog, sessionId: SessionId): Promise<void> {
  const events = await log.readAfter(sessionId, 0);
  if (lastLifecycle(events) === "agent-started") {
    await log.append(sessionId, { kind: "agent-exited", payload: { exitCode: null } });
  }
  const unanswered = unansweredRequests(events);
  for (const requestId of unanswered) {
    const payload = { requestId, cancelled: true as const, automatic: { reason: STOPPED } };
    await log.append(sessionId, { kind: "permission-answered", payload });
  }
  await log.append(sessionId, {
    kind: "agent-interrupted",
    payload: { droppedRequests: unanswered.length },
  });
}

async function recoverSession(log: EventLog, sessionId: SessionId): Promise<void> {
  const events = await log.readAfter(sessionId, 0);
  const kinds = events.map((event) => event.kind);
  if (lastLifecycle(events) === "agent-started" && !kinds.includes("session-archived")) {
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
