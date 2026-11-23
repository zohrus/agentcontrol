import { RelayName, type SessionId } from "@agentcontrol/protocol";
import type { RelayAccess } from "../setup/relay.ts";

/**
 * The session list has exactly these sessions, every one interrupted (its agent is gone), none with a
 * request nobody can answer, each remembering all of its events and the two the interruption added
 * (the dropped request answered as cancelled, and the interruption).
 */
export async function expectListToHoldRebuiltSessions(
  relay: RelayAccess,
  call: { ids: SessionId[]; eventCount: number },
): Promise<void> {
  const { sessions } = await relay.call(RelayName.sessionsList, {});
  const listed = sessions.map((session) => session.id).sort();
  if (JSON.stringify(listed) !== JSON.stringify([...call.ids].sort())) {
    throw new Error(
      `expected ${String(call.ids.length)} sessions to be listed, but ${String(listed.length)} were`,
    );
  }
  const wrong = sessions.find(
    (session) =>
      session.status !== "interrupted" ||
      session.pendingPermissions.length > 0 ||
      session.turnRunning ||
      session.lastSeq !== call.eventCount + 2,
  );
  if (wrong) {
    const seen = `${wrong.status}, ${String(wrong.pendingPermissions.length)} requests, last event ${String(wrong.lastSeq)}`;
    throw new Error(
      `expected session "${wrong.title}" to be interrupted with no request after ${String(call.eventCount + 2)} events, but it is ${seen}`,
    );
  }
}
