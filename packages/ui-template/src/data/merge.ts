import type { SessionEvent, SessionRow } from "@agentcontrol/sdk";
import { keyOf, refOf } from "./session-ref.ts";

const rowKey = (row: SessionRow): string => keyOf(refOf(row));

const newestFirst = (a: SessionRow, b: SessionRow): number =>
  b.createdAt.localeCompare(a.createdAt);

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
  const held = new Map(have.map((row) => [rowKey(row), row]));
  const rows = fetched.map((row) => {
    const current = held.get(rowKey(row));
    return current !== undefined && current.lastSeq > row.lastSeq ? current : row;
  });
  const fetchedKeys = new Set(fetched.map(rowKey));
  const extra = have.filter((row) => !fetchedKeys.has(rowKey(row)));
  return [...rows, ...extra].toSorted(newestFirst);
}

/** Adds or replaces sessions from the live stream, newest first. */
export function upsertSessions(
  have: readonly SessionRow[],
  pushed: readonly SessionRow[],
): readonly SessionRow[] {
  const byKey = new Map(have.map((row) => [rowKey(row), row]));
  for (const row of pushed) byKey.set(rowKey(row), row);
  return [...byKey.values()].toSorted(newestFirst);
}
