import type { SessionEvent } from "@agentcontrol/protocol";
import type { RelayAccess, Session } from "../setup/relay.ts";
import { forSession } from "../setup/session-events.ts";

type SetupOutput = Extract<SessionEvent, { kind: "setup-output" }>;

function setupOutputOf(relay: RelayAccess, session: Session): string {
  return relay.events.entries
    .filter((event): event is SetupOutput => event.kind === "setup-output")
    .filter((event) => event.sessionId === session.id)
    .map((event) => event.payload.text)
    .join("");
}

/** The setup script printed this text, and it is recorded before the agent started. */
export async function expectSetupOutputBeforeAgentStarts(
  relay: RelayAccess,
  call: { session: Session; text: string },
): Promise<void> {
  const { session, text } = call;
  await relay.events.waitFor(
    forSession(session, "agent-started"),
    `expected the agent of session "${session.title}" to start after its setup`,
  );
  const startedAt = relay.events.entries.findIndex(forSession(session, "agent-started"));
  const printedAt = relay.events.entries.findIndex(
    (event) =>
      event.kind === "setup-output" &&
      event.sessionId === session.id &&
      event.payload.text.includes(text),
  );
  if (printedAt === -1 || printedAt > startedAt) {
    throw new Error(
      `expected "${text}" in the setup output of session "${session.title}" before its agent started`,
    );
  }
}

async function portBlockOf(relay: RelayAccess, session: Session): Promise<string> {
  await relay.events.waitFor(
    forSession(session, "setup-finished"),
    `expected the setup of session "${session.title}" to finish`,
  );
  const found = /PORT=(\d+) BASE=(\d+)/.exec(setupOutputOf(relay, session));
  if (found?.[1] === undefined || found[1] !== found[2]) {
    throw new Error(`expected the setup of session "${session.title}" to print its port block`);
  }
  return found[1];
}

/** The two sessions' setup scripts saw different PORT / AGENTCONTROL_PORT_BASE values. */
export async function expectDifferentPortBlocks(
  relay: RelayAccess,
  sessions: { first: Session; second: Session },
): Promise<void> {
  const first = await portBlockOf(relay, sessions.first);
  const second = await portBlockOf(relay, sessions.second);
  if (first === second) {
    throw new Error(
      `expected the two sessions to get different port blocks, but both got ${first}`,
    );
  }
}
