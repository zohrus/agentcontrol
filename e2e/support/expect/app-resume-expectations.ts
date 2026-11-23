import type { AppAccess, Session } from "../setup/app.ts";
import { eventually } from "../setup/eventually.ts";

/** The session list shows the session as interrupted, with no request waiting for an answer. */
export async function expectSessionInterrupted(app: AppAccess, session: Session): Promise<void> {
  await eventually(`expected session "${session.title}" to be interrupted`, async () => {
    const listed = (await app.sdk.sessions.list()).find((row) => row.id === session.id);
    if (listed === undefined) return "it is not listed";
    if (listed.status !== "interrupted") return `it is ${listed.status}`;
    return listed.pendingPermissions.length === 0 ? undefined : "a request is still waiting";
  });
}

/** The session's history says it was resumed, and what the new agent remembers. */
export async function expectResumeToBeInTheHistory(
  app: AppAccess,
  call: { session: Session; contextRestored: boolean },
): Promise<void> {
  const { session, contextRestored } = call;
  await eventually(
    `expected the history of session "${session.title}" to say it was resumed`,
    async () => {
      const events = await app.sdk.sessions.events(session.id, { after: 0 });
      const resumed = events.find((event) => event.kind === "session-resumed");
      if (resumed?.kind !== "session-resumed") return "it does not";
      return resumed.payload.contextRestored === contextRestored
        ? undefined
        : `it says the context was ${resumed.payload.contextRestored ? "" : "not "}restored`;
    },
  );
}
