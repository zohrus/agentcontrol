import { RelayName } from "@agentcontrol/protocol";
import { eventually } from "../setup/eventually.ts";
import type { RelayAccess, Session } from "../setup/relay.ts";

/** The log shows the agent exited this many times, the last time with this exit code. */
export async function expectAgentToHaveExited(
  relay: RelayAccess,
  call: { session: Session; times: number; withCode: number },
): Promise<void> {
  const { session, times, withCode } = call;
  await eventually(
    `expected the agent of session "${session.title}" to have exited ${String(times)} times`,
    async () => {
      const { events } = await relay.call(RelayName.eventsRead, { sessionId: session.id });
      const exits = events.flatMap((event) =>
        event.kind === "agent-exited" ? [event.payload.exitCode] : [],
      );
      const right = exits.length === times && exits.at(-1) === withCode;
      return right ? undefined : `it exited ${JSON.stringify(exits)}`;
    },
  );
}
