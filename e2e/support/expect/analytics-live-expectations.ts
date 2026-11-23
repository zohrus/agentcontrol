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

/** The app's error log soon says the usage could not be read, with the relay's own reason. */
export function expectTheLogToSayUsageCouldNotBeRead(log: { lines(): string[] }): Promise<void> {
  return eventually("expected the app to log that usage could not be read", () => {
    const said = log
      .lines()
      .some((line) => /Could not read the usage of .*cannot be read/.test(line));
    return Promise.resolve(said ? undefined : `it logged ${JSON.stringify(log.lines())}`);
  });
}

/**
 * The session's waiting time in a range that ended one millisecond after its request was asked is
 * no more than that millisecond, however long the request has been waiting since.
 */
export async function expectWaitingNotToRunPastTheRange(app: AppAccess, title: string) {
  const asked = await app.streamed.waitFor(
    (event) => event.kind === "permission-requested",
    "expected the agent to ask for permission",
  );
  const to = new Date(Date.parse(asked.ts) + 1).toISOString();
  const rows = await app.sdk.analytics.sessions({ to });
  const waited = rows.find((row) => row.title === title)?.waitingMs;
  if (waited !== undefined && waited <= 1) return;
  const saw = String(waited);
  throw new Error(
    `expected "${title}" to have waited at most 1 ms inside the range, but it is ${saw}`,
  );
}

/** The summary soon counts this many turns. */
export function expectAnalyticsToCountTurns(app: AppAccess, turns: number): Promise<void> {
  return eventually(`expected the analytics to count ${String(turns)} turns`, async () => {
    const { totals } = await app.sdk.analytics.summary({});
    return totals.turns === turns ? undefined : `they count ${String(totals.turns)}`;
  });
}
