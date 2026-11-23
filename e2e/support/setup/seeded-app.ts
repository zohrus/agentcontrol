import { join } from "node:path";
import type { SessionAnalytics } from "@agentcontrol/sdk";
import type { AppAccess } from "./app.ts";
import { eventually } from "./eventually.ts";
import { type SeededSession, writeSeededSessions } from "./seeded-analytics.ts";
import { type RunningApp, type StartOptions, startAppWithLocalWorkspace } from "./start-app.ts";

const tokensOf = (session: SeededSession): number =>
  session.turns.reduce((sum, turn) => {
    const t = turn.tokens;
    return sum + (t ? t.input + t.output + t.cacheRead + t.cacheWrite : 0);
  }, 0);

function isComplete(rows: SessionAnalytics[], session: SeededSession): boolean {
  const row = rows.find((candidate) => candidate.sessionId === session.id);
  return row?.turns === session.turns.length && row.tokens.total === tokensOf(session);
}

/** Waits until the app has saved every seeded session's events and usage, so analytics are complete. */
async function waitUntilAnalyticsHaveSeen(
  app: AppAccess,
  sessions: SeededSession[],
): Promise<void> {
  await eventually("expected the app to have saved every seeded session", async () => {
    const rows = await app.sdk.analytics.sessions({});
    const missing = sessions.filter((session) => !isComplete(rows, session));
    return missing.length === 0
      ? undefined
      : `it still lacks ${missing.map((m) => m.id).join(", ")}`;
  });
}

/**
 * Starts the app, puts these sessions' logs into the relay's data folder, and restarts the relay so
 * it reads them. The app then syncs them like any session; their timestamps are the test's own.
 */
export async function startAppWithSeededSessions(
  sessions: SeededSession[],
  options: StartOptions = {},
): Promise<RunningApp> {
  const app = await startAppWithLocalWorkspace(options);
  await writeSeededSessions({ relayDataDir: join(app.dataDir, "relay"), sessions });
  await app.theRelayStops();
  await app.theRelayStartsAgain();
  await waitUntilAnalyticsHaveSeen(app, sessions);
  return app;
}
