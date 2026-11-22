import type { SessionEvent, SessionId, SessionSummary } from "@agentcontrol/protocol";

export interface Workspace {
  id: string;
  label: string;
  kind: "local" | "ssh";
  sshHost?: string;
  lastSeenAt?: string;
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
  /** Idempotent: an event already stored (same workspace, session, seq) is ignored. */
  saveEvents(workspaceId: string, events: SessionEvent[]): void;
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
  close(): void;
}

export interface StoreOptions {
  path: string;
}
