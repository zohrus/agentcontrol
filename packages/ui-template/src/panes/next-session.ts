import { sameSession, type SessionRef } from "../data/index.ts";
import type { SessionListEntry } from "../session-list/index.ts";

/**
 * The session to show when `leaving` goes away: the one after it in the list, else the one before
 * it; none when it was the only one (archived sessions are not offered).
 */
export function nextSessionAfter(
  entries: readonly SessionListEntry[],
  leaving: SessionRef,
): SessionRef | undefined {
  const open = entries.filter((entry) => entry.summary.status !== "archived");
  const index = open.findIndex((entry) => sameSession(entry.ref, leaving));
  if (index < 0) return undefined;
  return (open[index + 1] ?? open[index - 1])?.ref;
}
