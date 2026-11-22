import type { SessionId } from "@agentcontrol/protocol";
import type { EventLog } from "../event-log/index.ts";

async function recoverSession(log: EventLog, sessionId: SessionId): Promise<void> {
  const kinds = (await log.readAfter(sessionId, 0)).map((event) => event.kind);
  const lifecycle = kinds.filter((kind) => kind === "agent-started" || kind === "agent-exited");
  if (lifecycle.at(-1) === "agent-started" && !kinds.includes("session-archived")) {
    await log.append(sessionId, { kind: "agent-exited", payload: { exitCode: null } });
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
