import type { SessionEvent, SessionRow, UsageRow, WorkspaceInfo } from "@agentcontrol/sdk";
import {
  agentLabel,
  type PendingPermission,
  type SessionListEntry,
  type WorkspaceTag,
} from "../session-list/index.ts";
import { formatCost, type SessionUsage } from "../status/index.ts";
import { canTakeCommands, connectionName } from "../workspaces/index.ts";
import type { DataState } from "./model.ts";
import { busyKey } from "./pending.ts";
import { keyOf, LOCAL_WORKSPACE, refOf } from "./session-ref.ts";

/** How the user knows a workspace: the Mac itself is "This Mac", anything else keeps its name. */
export function workspaceLabel(id: string): string {
  return id === LOCAL_WORKSPACE ? "This Mac" : id;
}

/** The workspace a session runs on; until the workspace list arrives it is taken to be connected. */
function tagOf(row: SessionRow, workspaces: readonly WorkspaceInfo[]): WorkspaceTag {
  const info = workspaces.find((workspace) => workspace.id === row.workspaceId);
  if (!info)
    return { id: row.workspaceId, label: workspaceLabel(row.workspaceId), state: "connected" };
  return { id: info.id, label: info.label, state: info.state, reason: info.reason };
}

/** The permission request a row offers Approve and Deny for: only when exactly one is pending. */
function pendingPermissionOf(row: SessionRow): PendingPermission | undefined {
  const [only, ...others] = row.pendingPermissions;
  if (only === undefined || others.length > 0) return undefined;
  return { requestId: only.requestId, title: only.toolCall.title, options: only.options };
}

/** Sessions of a removed workspace say where they came from, since they are listed together. */
function detailOf(row: SessionRow, workspace: WorkspaceTag): string | undefined {
  if (workspace.state !== "removed") return undefined;
  return `${agentLabel(row.agent)} · ${row.status} · read-only · from ${workspace.label}`;
}

/** The pending permission with the answer that is on its way, when one is. */
function withAnswering(permission: PendingPermission | undefined, answering: string | undefined) {
  return permission && { ...permission, answering };
}

/** What the row says while the user's action on it is in flight: archiving, or the answer being sent. */
function inFlightOf(row: SessionRow, busy: DataState["pending"]["busy"]) {
  const archiving = busy[busyKey("archive", keyOf(refOf(row)))] !== undefined;
  const answers = row.pendingPermissions.map((p) => busy[busyKey("answer", p.requestId)]);
  return { archiving, answering: answers.find((choice) => choice !== undefined) };
}

/** One session's list entry: its workspace, its single pending permission, what is in flight. */
function entryOf(call: {
  row: SessionRow;
  workspaces: readonly WorkspaceInfo[];
  busy: DataState["pending"]["busy"];
}): SessionListEntry {
  const { row, busy } = call;
  const workspace = tagOf(row, call.workspaces);
  const readOnly = !canTakeCommands(workspace);
  const entry: SessionListEntry = { summary: row, ref: refOf(row), workspace, readOnly };
  const { archiving, answering } = inFlightOf(row, busy);
  const detail = archiving ? "Archiving…" : detailOf(row, workspace);
  const pending = readOnly ? undefined : withAnswering(pendingPermissionOf(row), answering);
  return { ...entry, ...(detail && { detail }), ...(pending && { pendingPermission: pending }) };
}

/** One list entry per session. */
export function toEntries(
  call: { sessions: readonly SessionRow[]; workspaces: readonly WorkspaceInfo[] },
  busy: DataState["pending"]["busy"],
): SessionListEntry[] {
  return call.sessions.map((row) => entryOf({ row, workspaces: call.workspaces, busy }));
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

/** The names of the workspaces that work: before the list arrives, just this Mac. */
export function connectedLabels(workspaces: readonly WorkspaceInfo[]): string[] {
  if (workspaces.length === 0) return [workspaceLabel(LOCAL_WORKSPACE)];
  return workspaces.filter((workspace) => workspace.state === "connected").map((w) => w.label);
}

/** True for a workspace the user may want to look at: it is down, or its relay is out of date. */
export function needsAttention(workspace: WorkspaceInfo): boolean {
  return workspace.state === "offline" || workspace.state === "needs-relay-update";
}

/** What the status bar says about a workspace that needs a look: "Studio offline". */
export const attentionText = (workspace: WorkspaceInfo): string =>
  `${workspace.label} ${connectionName(workspace).toLowerCase()}`;
