import type { SessionId } from "@agentcontrol/protocol";
import type { EventLog } from "../event-log/index.ts";
import { applyEvent, emptyFold } from "./fold.ts";

const STOPPED = "the relay stopped";

/**
 * Marks the session interrupted: its agent is gone because the relay stopped. Requests the agent
 * was waiting on are answered as cancelled (with the reason, in the log) and counted in the event.
 */
export async function interruptSession(log: EventLog, sessionId: SessionId): Promise<void> {
  const events = await log.readAfter(sessionId, 0);
  const { pendingRequests } = events.reduce(applyEvent, emptyFold);
  for (const { requestId } of pendingRequests) {
    const payload = { requestId, cancelled: true as const, automatic: { reason: STOPPED } };
    await log.append(sessionId, { kind: "permission-answered", payload });
  }
  const droppedRequests = pendingRequests.length;
  await log.append(sessionId, { kind: "agent-interrupted", payload: { droppedRequests } });
}

const LIFECYCLE = ["agent-started", "agent-exited", "agent-interrupted"];

async function recoverSession(log: EventLog, sessionId: SessionId): Promise<void> {
  const kinds = (await log.readAfter(sessionId, 0)).map((event) => event.kind);
  const lifecycle = kinds.filter((kind) => LIFECYCLE.includes(kind));
  if (lifecycle.at(-1) === "agent-started" && !kinds.includes("session-archived")) {
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
