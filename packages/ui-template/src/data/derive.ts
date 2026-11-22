import type { SessionEvent, SessionRow, UsageRow } from "@agentcontrol/sdk";
import type { PendingPermission, SessionListEntry } from "../session-list/index.ts";
import { formatCost, type SessionUsage } from "../status/index.ts";
import { LOCAL_WORKSPACE } from "./merge.ts";
import type { DataState } from "./model.ts";

/** How the user knows a workspace: the Mac itself is "This Mac", anything else keeps its name. */
export function workspaceLabel(id: string): string {
  return id === LOCAL_WORKSPACE ? "This Mac" : id;
}

/** The permission request a row offers Approve and Deny for: only when exactly one is pending. */
function pendingPermissionOf(row: SessionRow): PendingPermission | undefined {
  const [only, ...others] = row.pendingPermissions;
  if (only === undefined || others.length > 0) return undefined;
  return { requestId: only.requestId, title: only.toolCall.title, options: only.options };
}

/** One list entry per session, with its workspace label and its single pending permission. */
export function toEntries(sessions: readonly SessionRow[]): SessionListEntry[] {
  return sessions.map((row) => {
    const entry: SessionListEntry = { summary: row, workspace: workspaceLabel(row.workspaceId) };
    const pendingPermission = pendingPermissionOf(row);
    return pendingPermission ? { ...entry, pendingPermission } : entry;
  });
}

/** Tokens and cost over every turn of a session, or nothing before its first turn ends. */
export function totalUsage(rows: readonly UsageRow[] | undefined): SessionUsage | undefined {
  if (rows === undefined || rows.length === 0) return undefined;
  const sum = (pick: (row: UsageRow) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);
  const priced = rows.filter((row) => row.costUsd !== undefined);
  return {
    inputTokens: sum((row) => row.inputTokens),
    outputTokens: sum((row) => row.outputTokens),
    cacheReadTokens: sum((row) => row.cacheReadTokens),
    cacheWriteTokens: sum((row) => row.cacheWriteTokens),
    ...(priced.length > 0 && { costUsd: priced.reduce((t, row) => t + (row.costUsd ?? 0), 0) }),
  };
}

/** Where the session's working copy is, from its first event. */
export function worktreePathOf(events: readonly SessionEvent[]): string | undefined {
  const created = events.find((event) => event.kind === "session-created");
  return created?.kind === "session-created" ? created.payload.worktreePath : undefined;
}

/** The cost of every turn that finished since midnight, formatted for the status bar. */
export function costToday(usage: DataState["usage"], now: Date): string {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const rows = Object.values(usage).flat();
  const today = rows.filter((row) => new Date(row.ts).getTime() >= midnight);
  return formatCost(today.reduce((total, row) => total + (row.costUsd ?? 0), 0));
}
