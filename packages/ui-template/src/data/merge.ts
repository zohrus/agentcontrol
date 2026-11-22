import type { SessionEvent, SessionRow } from "@agentcontrol/sdk";

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

/** Takes a fetched list into the one held, keeping any row that is already newer than the fetched one. */
export function mergeFetched(
  have: readonly SessionRow[],
  fetched: readonly SessionRow[],
): readonly SessionRow[] {
  const held = new Map(have.map((row) => [row.id, row]));
  const rows = fetched.map((row) => {
    const current = held.get(row.id);
    return current !== undefined && current.lastSeq > row.lastSeq ? current : row;
  });
  const fetchedIds = new Set(fetched.map((row) => row.id));
  const extra = have.filter((row) => !fetchedIds.has(row.id));
  return [...rows, ...extra].toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Adds or replaces sessions from the live stream, newest first. */
export function upsertSessions(
  have: readonly SessionRow[],
  pushed: readonly SessionRow[],
): readonly SessionRow[] {
  const byId = new Map(have.map((row) => [row.id, row]));
  for (const row of pushed) byId.set(row.id, row);
  return [...byId.values()].toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}
