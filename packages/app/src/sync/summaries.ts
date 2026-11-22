import { SessionSummary } from "@agentcontrol/protocol";
import type { Store } from "../store/index.ts";

/** Saves the relay's summaries and returns only the ones that are new or different. */
export function saveChangedSummaries(options: {
  store: Store;
  workspaceId: string;
  summaries: SessionSummary[];
}): SessionSummary[] {
  const { store, workspaceId, summaries } = options;
  const known = new Map(
    store.listSessions().map((stored) => [stored.id, SessionSummary.parse(stored)]),
  );
  const changed = summaries.filter((summary) => !Bun.deepEquals(known.get(summary.id), summary));
  store.saveSessionSummaries(workspaceId, summaries);
  return changed;
}
