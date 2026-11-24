import type { AppAccess, Session } from "../setup/app.ts";
import { eventually } from "../setup/eventually.ts";

/** The session list shows the session with this status and no waiting reason. */
export function expectSessionToBe(
  app: AppAccess,
  call: { session: Session; status: string },
): Promise<void> {
  const { session, status } = call;
  return eventually(`expected session "${session.title}" to be ${status}`, async () => {
    const row = await app.sdk.sessions.get(session.id);
    if (row.status === status && row.waitingReason === undefined) return undefined;
    const reason = row.waitingReason === undefined ? "" : ` (waiting: ${row.waitingReason})`;
    return `it is ${row.status}${reason}`;
  });
}

/** The session is waiting on the user for this reason. */
export function expectSessionToWaitFor(
  app: AppAccess,
  call: { session: Session; reason: string },
): Promise<void> {
  const { session, reason } = call;
  return eventually(`expected session "${session.title}" to wait for ${reason}`, async () => {
    const row = await app.sdk.sessions.get(session.id);
    return row.waitingReason === reason ? undefined : `it is ${row.status}`;
  });
}

/** No message was sent to the session's agent. */
export async function expectNoMessageSentToTheAgent(
  app: AppAccess,
  session: Session,
): Promise<void> {
  const events = await app.sdk.sessions.events(session.id, { after: 0 });
  if (!events.some((event) => event.kind === "prompt-sent")) return;
  throw new Error(`expected no message to be sent to the agent of "${session.title}", but one was`);
}

/** The session list titles the session like this. */
export function expectSessionTitleToBe(
  app: AppAccess,
  call: { session: Session; title: string },
): Promise<void> {
  const { session, title } = call;
  return eventually(`expected session "${session.title}" to be titled "${title}"`, async () => {
    const row = await app.sdk.sessions.get(session.id);
    return row.title === title ? undefined : `it is titled "${row.title}"`;
  });
}
