import type {
  DiffResult,
  FsEntry,
  SessionEvent,
  SessionRow,
  WorkspaceInfo,
} from "@agentcontrol/sdk";
import { useEffect, useMemo, useState } from "react";
import type { SessionListEntry } from "../session-list/index.ts";
import {
  attentionText,
  connectedLabels,
  costToday,
  needsAttention,
  toEntries,
  totalUsage,
} from "./derive.ts";
import {
  type Choices,
  type ConfigState,
  type DataState,
  fileKey,
  type FileVersions,
  type WorkspaceCheck,
} from "./model.ts";
import { useController } from "./provider.tsx";
import { isRow, keyOf, type SessionRef } from "./session-ref.ts";
import { useStoreValue } from "./store.ts";

const noEvents: readonly SessionEvent[] = [];
const noEntries: readonly FsEntry[] = [];
const noChoices: Choices = { repos: [], agents: [] };
const noCheck: WorkspaceCheck = { steps: [], running: false };

/** Reads one part of the data; re-renders only when that part changes. */
export function useData<V>(select: (state: DataState) => V): V {
  return useStoreValue(useController().store, select);
}

/** Tells the data layer which session is open, so it loads and keeps its history and changes. */
export function useOpenSession(ref: SessionRef | undefined): void {
  const { select } = useController();
  const workspaceId = ref?.workspaceId;
  const id = ref?.id;
  useEffect(() => {
    select(id === undefined || workspaceId === undefined ? undefined : { workspaceId, id });
  }, [select, workspaceId, id]);
}

/** Tells the data layer which file of the open session is shown. */
export function useOpenFile(ref: SessionRef | undefined, path: string | undefined): void {
  const { openFile } = useController();
  const workspaceId = ref?.workspaceId;
  const id = ref?.id;
  useEffect(() => {
    if (id !== undefined && workspaceId !== undefined) openFile({ ref: { workspaceId, id }, path });
  }, [openFile, workspaceId, id, path]);
}

const useSessions = (): readonly SessionRow[] => useData((s) => s.sessions);
const keyedBy = (ref: SessionRef | undefined): string | undefined =>
  ref === undefined ? undefined : keyOf(ref);
export const useSession = (ref: SessionRef | undefined): SessionRow | undefined =>
  useData((s) => s.sessions.find((row) => isRow(row, ref)));
export const useSessionEvents = (ref: SessionRef | undefined): readonly SessionEvent[] =>
  useData((s) => s.events[keyedBy(ref) ?? ""] ?? noEvents);
export const useDiff = (ref: SessionRef | undefined): DiffResult | undefined =>
  useData((s) => s.diffs[keyedBy(ref) ?? ""]);
export const useTree = (ref: SessionRef | undefined): readonly FsEntry[] =>
  useData((s) => s.trees[keyedBy(ref) ?? ""] ?? noEntries);
export const useChangesError = (ref: SessionRef | undefined): string | undefined =>
  useData((s) => s.changesErrors[keyedBy(ref) ?? ""]) || undefined;
export const useFile = (ref: SessionRef | undefined, path: string | undefined) =>
  useData((s): FileVersions | undefined =>
    ref === undefined || path === undefined ? undefined : s.files[fileKey(ref, path)],
  );
export const useTurnRunning = (ref: SessionRef | undefined): boolean =>
  useData((s) => s.sessions.find((row) => isRow(row, ref))?.turnRunning ?? false);
export const useUsage = (ref: SessionRef | undefined) =>
  totalUsage(useData((s) => s.usage[keyedBy(ref) ?? ""]));

/** Every workspace, "This Mac" first; removed ones included. */
export const useWorkspaces = (): readonly WorkspaceInfo[] => useData((s) => s.workspaces);
/** One workspace by id; undefined until the list has arrived. */
export const useWorkspace = (workspaceId: string | undefined): WorkspaceInfo | undefined =>
  useData((s) => s.workspaces.find((workspace) => workspace.id === workspaceId));
/** The repositories and agents a workspace offers; none until they have been loaded. */
export const useChoices = (workspaceId: string): Choices =>
  useData((s) => s.choices[workspaceId] ?? noChoices);
/** A workspace's latest checklist and whether it is running now. */
export const useWorkspaceCheck = (workspaceId: string): WorkspaceCheck =>
  useData((s) => s.checks[workspaceId] ?? noCheck);
/** Harness configuration: the items, the last review and apply, drift and what an import found. */
export const useConfigState = (): ConfigState => useData((s) => s.config);

/** The session list rows, each with its workspace and its single pending permission. */
export function useSessionEntries(): SessionListEntry[] {
  const sessions = useData((s) => s.sessions);
  const workspaces = useData((s) => s.workspaces);
  return useMemo(() => toEntries(sessions, workspaces), [sessions, workspaces]);
}

/** Today's date as text, refreshed every minute, so "today" is right after midnight too. */
function useDay(): string {
  const [day, setDay] = useState(() => new Date().toDateString());
  useEffect(() => {
    const timer = setInterval(() => {
      setDay(new Date().toDateString());
    }, 60_000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return day;
}

/** What the status bar counts: waiting and running sessions, today's cost and the connection. */
export function useStatusStats() {
  const sessions = useSessions();
  const usage = useData((s) => s.usage);
  const connection = useData((s) => s.connection);
  const workspaces = useData((s) => s.workspaces);
  const day = useDay();
  return useMemo(
    () => ({
      waiting: sessions.filter((row) => row.status === "waiting").length,
      running: sessions.filter((row) => row.status === "running" || row.status === "starting")
        .length,
      today: costToday(usage, new Date()),
      connection,
      connected: connection === "connected" ? connectedLabels(workspaces) : [],
      attention: workspaces.filter(needsAttention).map(attentionText),
    }),
    // `day` is a dependency so the sum starts again at midnight.
    [sessions, usage, connection, workspaces, day],
  );
}
