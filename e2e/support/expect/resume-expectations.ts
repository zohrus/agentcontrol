import { RelayName, type SessionEvent } from "@agentcontrol/protocol";
import type { RelayAccess, Session } from "../setup/relay.ts";
import { eventually } from "../setup/eventually.ts";
import { updatesOf } from "../setup/updates.ts";

async function logOf(relay: RelayAccess, session: Session): Promise<SessionEvent[]> {
  return (await relay.call(RelayName.eventsRead, { sessionId: session.id })).events;
}

/** The session's summary says no request is waiting for an answer. */
export async function expectNoRequestToBeWaiting(
  relay: RelayAccess,
  session: Session,
): Promise<void> {
  const { sessions } = await relay.call(RelayName.sessionsList, {});
  const waiting = sessions.find((listed) => listed.id === session.id)?.pendingPermissions ?? [];
  if (waiting.length > 0) {
    throw new Error(
      `expected no request of session "${session.title}" to be waiting, but ${String(waiting.length)} were`,
    );
  }
}

/** The log says the interruption dropped this many waiting requests. */
export async function expectInterruptionToHaveDropped(
  relay: RelayAccess,
  call: { session: Session; requests: number },
): Promise<void> {
  const { session, requests } = call;
  const events = await logOf(relay, session);
  const interruption = events.find((event) => event.kind === "agent-interrupted");
  const dropped =
    interruption?.kind === "agent-interrupted" ? interruption.payload.droppedRequests : -1;
  if (dropped !== requests) {
    throw new Error(
      `expected the log of session "${session.title}" to say ${String(requests)} request(s) were dropped, but it said ${String(dropped)}`,
    );
  }
}

/** The agent's text appears this many times in the log: replayed history is not logged again. */
export async function expectAgentTextInLogTimes(
  relay: RelayAccess,
  call: { session: Session; text: string; times: number },
): Promise<void> {
  const { session, text, times } = call;
  const heard = (await logOf(relay, session))
    .flatMap(updatesOf)
    .filter((update) => update.type === "agent-text" && update.text === text).length;
  if (heard !== times) {
    throw new Error(
      `expected "${text}" to be in the log of session "${session.title}" ${String(times)} time(s), but it was there ${String(heard)}`,
    );
  }
}

/** The log says the session was resumed, whether the agent remembers the work, and in these words. */
export async function expectResumeNote(
  relay: RelayAccess,
  call: { session: Session; contextRestored: boolean; saying: string },
): Promise<void> {
  const { session, contextRestored, saying } = call;
  const resumed = (await logOf(relay, session)).find((event) => event.kind === "session-resumed");
  if (resumed?.kind !== "session-resumed") {
    throw new Error(`expected the log of session "${session.title}" to say it was resumed`);
  }
  const { payload } = resumed;
  if (payload.contextRestored !== contextRestored || !payload.note.includes(saying)) {
    throw new Error(
      `expected the resume note of session "${session.title}" to say "${saying}" (context restored: ${String(contextRestored)}), but it said "${payload.note}" (context restored: ${String(payload.contextRestored)})`,
    );
  }
}

/** The agent said this in the log, which is read again until it did. */
export async function expectAgentToHaveSaidInLog(
  relay: RelayAccess,
  call: { session: Session; text: string },
): Promise<void> {
  const { session, text } = call;
  await eventually(
    `expected the agent of session "${session.title}" to say "${text}"`,
    async () => {
      const said = (await logOf(relay, session)).flatMap(updatesOf);
      const heard = said.some((update) => update.type === "agent-text" && update.text === text);
      return heard ? undefined : "it had not said so yet";
    },
  );
}
