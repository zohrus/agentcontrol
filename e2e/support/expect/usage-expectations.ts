import { RelayName, type UsageRow } from "@agentcontrol/protocol";
import type { RelayAccess, Session } from "../setup/relay.ts";

type TurnUsage = Pick<
  UsageRow,
  "model" | "inputTokens" | "outputTokens" | "cacheReadTokens" | "cacheWriteTokens"
>;

/** The relay reports one usage row for the session, with exactly these tokens and model. */
export async function expectOneTurnOfUsage(
  relay: RelayAccess,
  call: { session: Session; usage: TurnUsage },
): Promise<void> {
  const { session, usage } = call;
  const { rows } = await relay.call(RelayName.usage, { sessionId: session.id });
  const [row, ...others] = rows;
  const wanted = JSON.stringify(usage);
  const actual = row === undefined ? "no usage" : JSON.stringify(pickTurnUsage(row));
  if (others.length > 0 || actual !== wanted) {
    throw new Error(
      `expected session "${session.title}" to report ${wanted} in one row, but it reports ${actual}`,
    );
  }
}

function pickTurnUsage(row: UsageRow): TurnUsage {
  const { model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens } = row;
  return { model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens };
}
