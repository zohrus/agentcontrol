import type { DiffResult, FsEntry, SessionEvent, SessionId, SessionRow } from "@agentcontrol/sdk";
import { useEffect, useMemo, useState } from "react";
import type { SessionListEntry } from "../session-list/index.ts";
import { costToday, toEntries, totalUsage, workspaceLabel } from "./derive.ts";
import { LOCAL_WORKSPACE } from "./merge.ts";
import { fileKey, type DataState, type FileVersions } from "./model.ts";
import { useController } from "./provider.tsx";
import { useStoreValue } from "./store.ts";

const noEvents: readonly SessionEvent[] = [];
const noEntries: readonly FsEntry[] = [];

/** Reads one part of the data; re-renders only when that part changes. */
export function useData<V>(select: (state: DataState) => V): V {
  return useStoreValue(useController().store, select);
}

/** Tells the data layer which session is open, so it loads and keeps its history and changes. */
export function useOpenSession(id: SessionId | undefined): void {
  const { select } = useController();
  useEffect(() => {
    select(id);
  }, [select, id]);
}

/** Tells the data layer which file of the open session is shown. */
export function useOpenFile(id: SessionId | undefined, path: string | undefined): void {
  const { openFile } = useController();
  useEffect(() => {
    if (id !== undefined) openFile({ id, path });
  }, [openFile, id, path]);
}

const useSessions = (): readonly SessionRow[] => useData((s) => s.sessions);
export const useSession = (id: SessionId | undefined): SessionRow | undefined =>
  useData((s) => s.sessions.find((row) => row.id === id));
export const useSessionEvents = (id: SessionId | undefined): readonly SessionEvent[] =>
  useData((s) => (id === undefined ? undefined : s.events[id]) ?? noEvents);
export const useDiff = (id: SessionId | undefined): DiffResult | undefined =>
  useData((s) => (id === undefined ? undefined : s.diffs[id]));
export const useTree = (id: SessionId | undefined): readonly FsEntry[] =>
  useData((s) => (id === undefined ? undefined : s.trees[id]) ?? noEntries);
export const useChangesError = (id: SessionId | undefined): string | undefined =>
  useData((s) => (id === undefined ? undefined : s.changesErrors[id])) || undefined;
export const useFile = (id: SessionId | undefined, path: string | undefined) =>
  useData((s): FileVersions | undefined =>
    id === undefined || path === undefined ? undefined : s.files[fileKey(id, path)],
  );
export const useTurnRunning = (id: SessionId | undefined): boolean =>
  useData((s) => s.sessions.find((row) => row.id === id)?.turnRunning ?? false);
export const useUsage = (id: SessionId | undefined) =>
  totalUsage(useData((s) => (id === undefined ? undefined : s.usage[id])));

/** The session list rows, each with its workspace and its single pending permission. */
export function useSessionEntries(): SessionListEntry[] {
  const sessions = useData((s) => s.sessions);
  return useMemo(() => toEntries(sessions), [sessions]);
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
  const day = useDay();
  return useMemo(
    () => ({
      waiting: sessions.filter((row) => row.status === "waiting").length,
      running: sessions.filter((row) => row.status === "running" || row.status === "starting")
        .length,
      today: costToday(usage, new Date()),
      connection,
      connected: connection === "connected" ? [workspaceLabel(LOCAL_WORKSPACE)] : [],
    }),
    // `day` is a dependency so the sum starts again at midnight.
    [sessions, usage, connection, day],
  );
}
