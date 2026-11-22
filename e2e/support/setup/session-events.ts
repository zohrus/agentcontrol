import type { SessionEvent } from "@agentcontrol/protocol";
import type { RelayAccess, Session } from "./relay.ts";

/** Matches the events of one session, optionally only one kind. */
export const forSession =
  (session: Session, kind?: SessionEvent["kind"]) =>
  (event: SessionEvent): boolean =>
    event.sessionId === session.id && (kind === undefined || event.kind === kind);

/** Where the session's worktree is, read from the session's first event. */
export async function worktreeOf(relay: RelayAccess, session: Session): Promise<string> {
  const created = await relay.events.waitFor(
    forSession(session, "session-created"),
    `expected session "${session.title}" to have been created`,
  );
  if (created.kind !== "session-created") throw new Error("expected a session-created event");
  return created.payload.worktreePath;
}
