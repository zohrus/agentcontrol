import { RelayName, type SessionSummary } from "@agentcontrol/protocol";
import type { RelayAccess, Session } from "../setup/relay.ts";

function describeStatus(summary: SessionSummary): string {
  const reasons = { permission: "approval", reply: "a reply", "setup-failed": "a setup fix" };
  const reason = summary.waitingReason;
  return reason ? `waiting for ${reasons[reason]}` : summary.status;
}

/** The session's row in the session list; fails in plain words if it is not listed. */
export async function seesSession(relay: RelayAccess, session: Session): Promise<SessionSummary> {
  const { sessions } = await relay.call(RelayName.sessionsList, {});
  const listed = sessions.find((candidate) => candidate.id === session.id);
  if (!listed) throw new Error(`expected session "${session.title}" to be listed, but it is not`);
  return listed;
}

/** The session list shows the session with exactly this status and waiting reason. */
export async function expectListedAs(
  relay: RelayAccess,
  call: { session: Session; status: SessionSummary["status"]; wanted: string },
): Promise<void> {
  const { session } = call;
  const summary = await seesSession(relay, session);
  if (summary.status === call.status && describeStatus(summary) === call.wanted) return;
  throw new Error(
    `expected session "${session.title}" to be ${call.wanted}, but it is ${describeStatus(summary)}`,
  );
}
