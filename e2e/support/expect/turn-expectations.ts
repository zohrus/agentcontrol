import type { SessionEvent } from "@agentcontrol/protocol";
import type { RelayAccess, Session } from "../setup/relay.ts";
import { forSession } from "../setup/session-events.ts";
import { updatesOf } from "../setup/updates.ts";

/** The agent's turn ended with exactly this stop reason. */
export async function expectTurnToEndWithStopReason(
  relay: RelayAccess,
  call: { session: Session; stopReason: string },
): Promise<void> {
  const { session, stopReason } = call;
  const ended = await relay.events.waitFor(
    forSession(session, "turn-ended"),
    `expected the turn of session "${session.title}" to end with "${stopReason}", but it never ended`,
  );
  const actual = ended.kind === "turn-ended" ? ended.payload.stopReason : "";
  if (actual !== stopReason) {
    throw new Error(
      `expected the turn of session "${session.title}" to end with "${stopReason}", but it ended with "${actual}"`,
    );
  }
}

const toolStatusOf = (event: SessionEvent): string[] =>
  updatesOf(event).flatMap((update) =>
    update.type === "tool-updated" && update.status !== undefined ? [update.status] : [],
  );

/** The agent never completed a tool call: the command it asked about was not run. */
export function expectNoCommandToHaveRun(relay: RelayAccess, session: Session): void {
  const statuses = relay.events.entries.filter(forSession(session, "acp")).flatMap(toolStatusOf);
  if (statuses.includes("completed")) {
    throw new Error(`expected no command to run in session "${session.title}", but one did`);
  }
}
