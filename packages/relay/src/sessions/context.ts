import type { SessionId, SessionKind } from "@agentcontrol/protocol";
import type { AgentProcess, HostEnv } from "../agents/index.ts";
import type { EventInput, EventLog } from "../event-log/index.ts";
import type { PendingPermissions } from "../permissions/index.ts";
import type { RepoStore } from "../repos/index.ts";
import { RelayError } from "../rpc/index.ts";
import { ErrorCode } from "@agentcontrol/protocol";
import type { LiveSummaries } from "./live-summaries.ts";

/** What every session operation needs; built once by `createSessions`. */
export interface SessionContext {
  log: EventLog;
  permissions: PendingPermissions;
  /** Every session's summary, kept current from the log: read this, never fold the log again. */
  summaries: LiveSummaries;
  repos: RepoStore;
  worktreesDir: string;
  /** The relay's environment, for agent commands and what agents inherit. */
  hostEnv: HostEnv;
  /** Agents that are running right now. */
  live: Map<SessionId, AgentProcess>;
  /** After this, `record` drops events: what an agent says while it is being stopped is not kept. */
  stopRecording(): void;
  /** Appends an event without waiting; a failed write is reported on stderr. */
  record(sessionId: SessionId, input: EventInput): void;
  /** The next free index for a block of ports. */
  nextPortIndex(): number;
}

/** Where a session lives, as recorded in its `session-created` event. */
export interface SessionInfo {
  worktreePath: string;
  baseBranch: string;
  repoPath: string;
  branch: string;
  /** Absent means "worktree". For a "directory" session `worktreePath` is its folder. */
  kind?: SessionKind | undefined;
}

/** A session's location, from its in-memory state; fails with sessionNotFound when it has none. */
export async function sessionInfo(ctx: SessionContext, sessionId: SessionId): Promise<SessionInfo> {
  const created = ctx.summaries.created(sessionId);
  if (!created) throw new RelayError(ErrorCode.sessionNotFound, `No session "${sessionId}".`);
  return Promise.resolve(created.payload);
}
