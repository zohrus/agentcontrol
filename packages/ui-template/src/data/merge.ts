import type { SessionEvent, SessionRow, SessionSummary } from "@agentcontrol/sdk";

/** The only workspace there is until remote workspaces exist. */
export const LOCAL_WORKSPACE = "local";

/** Adds the events newer than the last one held; the same event is never held twice. */
export function appendEvents(
  have: readonly SessionEvent[],
  fresh: readonly SessionEvent[],
): readonly SessionEvent[] {
  const last = have.at(-1)?.seq ?? 0;
  const added = fresh.filter((event) => event.seq > last);
  return added.length === 0 ? have : [...have, ...added];
}

/** Adds or replaces sessions from the live stream, newest first. */
export function upsertSessions(
  have: readonly SessionRow[],
  summaries: readonly SessionSummary[],
): readonly SessionRow[] {
  const byId = new Map(have.map((row) => [row.id, row]));
  for (const summary of summaries) {
    const workspaceId = byId.get(summary.id)?.workspaceId ?? LOCAL_WORKSPACE;
    byId.set(summary.id, { ...summary, workspaceId });
  }
  return [...byId.values()].toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}
