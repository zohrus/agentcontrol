import type { RelayAccess, Session } from "../setup/relay.ts";
import { forSession } from "../setup/session-events.ts";
import { setupOutputOf } from "./setup-expectations.ts";

/** The agent never started: the session records why, in words, and the agent is marked as exited. */
export async function expectAgentToFailToStartBecause(
  relay: RelayAccess,
  call: { session: Session; reason: string },
): Promise<void> {
  const { session, reason } = call;
  await relay.events.waitFor(
    forSession(session, "agent-exited"),
    `expected the agent of session "${session.title}" to fail to start`,
  );
  const said = setupOutputOf(relay, session);
  if (!said.includes(reason)) {
    throw new Error(
      `expected the session to say "${reason}" when its agent failed to start, but it said ${JSON.stringify(said)}`,
    );
  }
}
