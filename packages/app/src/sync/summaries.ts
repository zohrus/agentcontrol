import { SessionSummary } from "@agentcontrol/protocol";
import type { Store, StoredSession } from "../store/index.ts";

/**
 * Saves the relay's summaries and returns only the ones that are new or different, as stored
 * sessions. A summary older than the stored one (its `lastSeq` is lower) is dropped: a push and a
 * list answer can reach the app in either order, and the newer one must win.
 */
export function saveChangedSummaries(options: {
  store: Store;
  workspaceId: string;
  summaries: SessionSummary[];
}): StoredSession[] {
  const { store, workspaceId } = options;
  const known = new Map(
    store.listSessions({ workspaceId }).map((stored) => [stored.id, SessionSummary.parse(stored)]),
  );
  const fresh = options.summaries.filter((s) => s.lastSeq >= (known.get(s.id)?.lastSeq ?? 0));
  const changed = fresh.filter((summary) => !Bun.deepEquals(known.get(summary.id), summary));
  store.saveSessionSummaries(workspaceId, changed);
  return changed.map((summary) => ({ ...summary, workspaceId }));
}
