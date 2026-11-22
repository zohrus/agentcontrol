import type { AppAccess, Session } from "../setup/app.ts";
import { eventually } from "../setup/eventually.ts";

/** The app reports exactly one turn of usage for the session, with these input and output tokens. */
export function expectAppToReportTokensOfOneTurn(
  app: AppAccess,
  call: { session: Session; input: number; output: number },
): Promise<void> {
  const { session, input, output } = call;
  const expectation = `expected session "${session.title}" to report one turn of ${String(input)} input and ${String(output)} output tokens`;
  return eventually(expectation, async () => {
    const rows = await app.sdk.sessions.usage(session.id);
    const [row] = rows;
    const matches = rows.length === 1 && row?.inputTokens === input && row.outputTokens === output;
    return matches ? undefined : `it reports ${JSON.stringify(rows)}`;
  });
}
