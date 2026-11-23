import { connectionDetail, connectionName } from "../workspaces/index.ts";
import type { SessionListEntry } from "./types.ts";

export type WorkspaceGroup = {
  /** Distinct per workspace; every removed workspace shares one group. */
  key: string;
  title: string;
  /** The connection in words, such as "Offline". */
  status: string;
  /** Why the workspace is not connected. */
  detail: string | undefined;
  entries: SessionListEntry[];
};

/** True for a session that is blocked until the user answers (one nobody can answer is not). */
export function isWaiting(entry: SessionListEntry): boolean {
  return entry.summary.status === "waiting" && !entry.readOnly;
}

function groupFor(entry: SessionListEntry): Omit<WorkspaceGroup, "entries"> {
  const { workspace } = entry;
  if (workspace.state === "removed") {
    const detail = "Sessions of removed workspaces stay readable.";
    return { key: "removed", title: "Removed", status: "", detail };
  }
  const detail = workspace.state === "connected" ? undefined : connectionDetail(workspace);
  return { key: workspace.id, title: workspace.label, status: connectionName(workspace), detail };
}

/**
 * Groups entries by workspace in first-seen order; archived ones only when asked for.
 * Inside a group, sessions waiting on the user come first.
 */
export function groupByWorkspace(
  entries: readonly SessionListEntry[],
  showArchived: boolean,
): WorkspaceGroup[] {
  const groups = new Map<string, WorkspaceGroup>();
  for (const entry of entries) {
    if ((entry.summary.status === "archived") !== showArchived) continue;
    const found = groupFor(entry);
    const group = groups.get(found.key) ?? { ...found, entries: [] };
    group.entries.push(entry);
    groups.set(found.key, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    entries: group.entries.toSorted((a, b) => Number(isWaiting(b)) - Number(isWaiting(a))),
  }));
}
