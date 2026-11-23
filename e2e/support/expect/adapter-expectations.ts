import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RelayAccess, Session } from "../setup/relay.ts";
import { forSession } from "../setup/session-events.ts";
import { setupOutputOf } from "./setup-expectations.ts";

/** Waits for the end of the agent, which cannot run its adapter on this machine, then reads. */
async function outputOnceTheAgentEnded(relay: RelayAccess, session: Session): Promise<string> {
  await relay.events.waitFor(
    forSession(session, "agent-exited"),
    `expected the agent of session "${session.title}" to end, because its adapter cannot run here`,
  );
  return setupOutputOf(relay, session);
}

/** The session's output tells the user this text. */
export async function expectSessionToTellTheUser(
  relay: RelayAccess,
  call: { session: Session; text: string },
): Promise<void> {
  const { session, text } = call;
  const said = await outputOnceTheAgentEnded(relay, session);
  if (!said.includes(text)) {
    throw new Error(`expected session "${session.title}" to say "${text}", but it said: ${said}`);
  }
}

/** The session's output does not mention this text. */
export async function expectSessionNotToMention(
  relay: RelayAccess,
  call: { session: Session; text: string },
): Promise<void> {
  const { session, text } = call;
  if ((await outputOnceTheAgentEnded(relay, session)).includes(text)) {
    throw new Error(`expected session "${session.title}" not to say "${text}", but it did`);
  }
}

/** The relay keeps what it downloads for agents in its own folder, not in the user's global cache. */
export function expectAdaptersKeptInTheRelayFolder(relay: RelayAccess): void {
  const folder = join(relay.dataDir, "adapters");
  if (!existsSync(folder)) throw new Error(`expected the relay to keep adapters in ${folder}`);
}
