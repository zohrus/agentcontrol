import type { SessionListEntry } from "./types.ts";

export type WorkspaceGroup = { workspace: string; entries: SessionListEntry[] };

/** True for a session that is blocked until the user answers. */
export function isWaiting(entry: SessionListEntry): boolean {
  return entry.summary.status === "waiting";
}

/**
 * Groups entries by workspace in first-seen order; archived ones only when asked for.
 * Inside a group, sessions waiting on the user come first.
 */
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
  return [...groups].map(([workspace, list]) => ({
    workspace,
    entries: list.toSorted((a, b) => Number(isWaiting(b)) - Number(isWaiting(a))),
  }));
}
