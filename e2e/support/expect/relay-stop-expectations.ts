import type { RelayAccess, Session } from "../setup/relay.ts";
import { forSession } from "../setup/session-events.ts";
import { eventsStreamedByRelay, expectReplyAsUpdate } from "./update-expectations.ts";

/** The app, still connected while the relay stopped, was told that the session's agent exited. */
export async function expectAppToHaveBeenToldTheAgentExited(
  relay: RelayAccess,
  session: Session,
): Promise<void> {
  await relay.events.waitFor(
    forSession(session, "agent-exited"),
    `expected the app to be told that the agent of "${session.title}" exited when the relay stopped`,
  );
}

/** The history the relay replays holds the agent's last reply, followed by the agent's exit. */
export async function expectHistoryToEndWithTheReplyAndTheExit(
  relay: RelayAccess,
  call: { session: Session; reply: string },
): Promise<void> {
  const { session, reply } = call;
  await expectReplyAsUpdate(eventsStreamedByRelay(relay, session), reply);
  const kinds = relay.events.entries
    .filter((event) => event.sessionId === session.id)
    .map((event) => event.kind);
  if (!kinds.includes("agent-exited")) {
    throw new Error(`expected the history of "${session.title}" to hold the agent's exit`);
  }
}
