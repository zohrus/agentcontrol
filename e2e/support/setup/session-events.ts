import type { SessionEvent } from "@agentcontrol/protocol";
import type { RelayAccess, Session } from "./relay.ts";

/** Matches the events of one session, optionally only one kind. */
export const forSession =
  (session: Session, kind?: SessionEvent["kind"]) =>
  (event: SessionEvent): boolean =>
    event.sessionId === session.id && (kind === undefined || event.kind === kind);

/** Where the session's worktree is, once it is made (the relay makes it after creating the session). */
export async function worktreeOf(relay: RelayAccess, session: Session): Promise<string> {
  await relay.events.waitFor(
    forSession(session, "setup-finished"),
    `expected the worktree of session "${session.title}" to be made`,
  );
  const created = await relay.events.waitFor(
    forSession(session, "session-created"),
    `expected session "${session.title}" to have been created`,
  );
  if (created.kind !== "session-created") throw new Error("expected a session-created event");
  return created.payload.worktreePath;
}
