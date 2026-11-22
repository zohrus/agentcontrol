import type { SessionListEntry } from "./types.ts";

export type WorkspaceGroup = { workspace: string; entries: SessionListEntry[] };

/** Groups entries by workspace in first-seen order; archived ones only when asked for. */
export function groupByWorkspace(
  entries: readonly SessionListEntry[],
  showArchived: boolean,
): WorkspaceGroup[] {
  const groups = new Map<string, SessionListEntry[]>();
  for (const entry of entries) {
    const archived = entry.summary.status === "archived";
    if (archived !== showArchived) continue;
    const list = groups.get(entry.workspace) ?? [];
    list.push(entry);
    groups.set(entry.workspace, list);
  }
  return [...groups].map(([workspace, list]) => ({ workspace, entries: list }));
}
