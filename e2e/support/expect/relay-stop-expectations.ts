import type { RelayAccess, Session } from "../setup/relay.ts";
import type { StuckClient } from "../setup/stuck-client.ts";
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

/** The relay stopped and its connection to the client that would not hang up is gone. */
export async function expectClientToHaveBeenCutOff(client: StuckClient): Promise<void> {
  const state = await Promise.race([
    client.cutOff.then(() => "cut off"),
    Bun.sleep(500).then(() => "still connected"),
  ]);
  if (state !== "cut off") {
    throw new Error(
      "expected the relay to have cut off the client that never hangs up, but it is still connected",
    );
  }
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
