import type { AppAccess } from "../setup/app.ts";
import { eventually } from "../setup/eventually.ts";

const MINUTE_MS = 60_000;

/** The session is interrupted, and the analytics count at most a minute of waiting and working. */
export async function expectSessionNotToHaveWaitedWhileInterrupted(
  app: AppAccess,
  title: string,
): Promise<void> {
  await eventually(`expected "${title}" to be interrupted in the session list`, async () => {
    const listed = (await app.sdk.sessions.list()).find((each) => each.title === title);
    return listed?.status === "interrupted" ? undefined : `it is ${listed?.status ?? "missing"}`;
  });
  await eventually(`expected the analytics to count at most a minute for "${title}"`, async () => {
    const row = (await app.sdk.analytics.sessions({})).find((each) => each.title === title);
    if (row === undefined) return "it is not listed";
    return row.waitingMs + row.workingMs <= MINUTE_MS
      ? undefined
      : `it counts ${String(row.waitingMs)} ms waiting`;
  });
}
