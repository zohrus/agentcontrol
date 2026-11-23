import type { AppAccess } from "../setup/app.ts";
import { eventually } from "../setup/eventually.ts";

/** The summary soon counts one session with this many input and output tokens (and no more). */
export function expectAnalyticsToCountOneTurn(
  app: AppAccess,
  call: { input: number; output: number },
): Promise<void> {
  const wanted = `${String(call.input)} input and ${String(call.output)} output tokens`;
  return eventually(`expected the analytics to count one turn of ${wanted}`, async () => {
    const { totals } = await app.sdk.analytics.summary({});
    const { input, output } = totals.tokens;
    const right = totals.sessions === 1 && input === call.input && output === call.output;
    return right
      ? undefined
      : `they count ${JSON.stringify({ sessions: totals.sessions, input, output })}`;
  });
}

/** The analytics show the session's wait for an answer as growing: more than zero seconds so far. */
export function expectAnalyticsToShowSessionWaiting(app: AppAccess, title: string): Promise<void> {
  return eventually(`expected the analytics to show "${title}" waiting for the user`, async () => {
    const rows = await app.sdk.analytics.sessions({});
    const waited = rows.find((row) => row.title === title)?.waitingMs ?? 0;
    return waited > 0 ? undefined : "it has waited 0 seconds";
  });
}
