import type {
  ScopedItem,
  SessionEvent,
  SessionId,
  SessionSummary,
  UsageRow,
} from "@agentcontrol/protocol";
import type { StoredUsage } from "./usage.ts";

export interface Workspace {
  id: string;
  label: string;
  kind: "local" | "ssh";
  sshHost?: string;
  lastSeenAt?: string;
  /** When the user removed the workspace; its sessions stay readable. */
  removedAt?: string;
}

/** A relay's summary plus the workspace it came from; session ids are only unique per workspace. */
export interface StoredSession extends SessionSummary {
  workspaceId: string;
}

export interface SessionFilter {
  archived?: boolean;
  /** Only this workspace's sessions. */
  workspaceId?: string;
}

export interface Store {
  upsertWorkspace(workspace: Workspace): void;
  /** Every workspace ever added, removed ones included, oldest first. */
  listWorkspaces(): Workspace[];
  /**
   * Idempotent: an event already stored (same workspace, session, seq) is ignored. The events were
   * made with this version of the relay's event translation, which the store notes per session.
   */
  saveEvents(call: { workspaceId: string; list: SessionEvent[]; normaliserVersion: number }): void;
  /** Replaces a session's stored events (same seqs, new payloads) in one transaction. */
  replaceSessionEvents(call: {
    workspaceId: string;
    sessionId: SessionId;
    list: SessionEvent[];
    version: number;
  }): void;
  /** Changes whenever saved events are replaced (not when new ones are added), for what is derived from them. */
  revision(): number;
  /** Sessions whose stored events were made with an older translation version than this. */
  sessionsNormalisedBefore(call: { workspaceId: string; version: number }): SessionId[];
  /** Highest stored seq per session of a workspace, to resume a relay subscription. */
  lastSeqs(workspaceId: string): Record<string, number>;
  /** Events of a session with seq > afterSeq, in order, at most `limit` (default 1000). */
  eventsAfter(query: {
    workspaceId: string;
    sessionId: SessionId;
    afterSeq: number;
    limit?: number;
  }): SessionEvent[];
  /** Insert or update the relay's summaries for a workspace. */
  saveSessionSummaries(workspaceId: string, summaries: SessionSummary[]): void;
  listSessions(filter?: SessionFilter): StoredSession[]; // newest first
  getSession(key: { workspaceId: string; sessionId: SessionId }): StoredSession | undefined;
  /** The sessions with this id in any workspace (ids are only unique per workspace). */
  findSessions(sessionId: SessionId): StoredSession[];
  /**
   * Replaces the saved usage rows of these sessions with the relay's current lists (one row per
   * finished turn, oldest first), so reading the same list again changes nothing.
   */
  replaceUsage(call: { workspaceId: string; sessionIds: string[]; rows: UsageRow[] }): void;
  /** Every saved usage row of every workspace; analytics read these when a workspace is offline. */
  listUsage(): StoredUsage[];
  /** Replaces every harness-config item with the given ones. */
  replaceConfigItems(items: ScopedItem[]): void;
  /** The harness-config items, one entry per item and scope. */
  listConfigItems(): ScopedItem[];
  close(): void;
}

export interface StoreOptions {
  path: string;
}
