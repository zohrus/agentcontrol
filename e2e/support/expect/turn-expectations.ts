import type { SessionEvent } from "@agentcontrol/protocol";
import { z } from "zod";
import type { RelayAccess, Session } from "../setup/relay.ts";
import { forSession } from "../setup/session-events.ts";

const ToolCallUpdate = z.object({
  method: z.literal("session/update"),
  params: z.object({
    update: z.object({ sessionUpdate: z.literal("tool_call_update"), status: z.string() }),
  }),
});

/** The agent's turn ended with exactly this ACP stop reason. */
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

const toolStatusOf = (event: SessionEvent): string[] => {
  const update = ToolCallUpdate.safeParse(event.kind === "acp" ? event.payload.message : undefined);
  return update.success ? [update.data.params.update.status] : [];
};

/** The agent never completed a tool call: the command it asked about was not run. */
export function expectNoCommandToHaveRun(relay: RelayAccess, session: Session): void {
  const statuses = relay.events.entries.filter(forSession(session, "acp")).flatMap(toolStatusOf);
  if (statuses.includes("completed")) {
    throw new Error(`expected no command to run in session "${session.title}", but one did`);
  }
}
