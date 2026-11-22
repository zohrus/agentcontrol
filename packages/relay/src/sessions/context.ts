import type { SessionEvent, SessionId } from "@agentcontrol/protocol";
import type { AgentProcess } from "../agents/index.ts";
import type { EventInput, EventLog } from "../event-log/index.ts";
import type { PendingPermissions } from "../permissions/index.ts";
import type { RepoStore } from "../repos/index.ts";
import { RelayError } from "../rpc/index.ts";
import { ErrorCode } from "@agentcontrol/protocol";

/** What every session operation needs; built once by `createSessions`. */
export interface SessionContext {
  log: EventLog;
  permissions: PendingPermissions;
  repos: RepoStore;
  worktreesDir: string;
  /** Agents that are running right now. */
  live: Map<SessionId, AgentProcess>;
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
}

/** Reads a session's location from its log; fails with sessionNotFound when it has none. */
export async function sessionInfo(ctx: SessionContext, sessionId: SessionId): Promise<SessionInfo> {
  const events = await ctx.log.readAfter(sessionId, 0);
  const created = events.find(
    (event): event is Extract<SessionEvent, { kind: "session-created" }> =>
      event.kind === "session-created",
  );
  if (!created) throw new RelayError(ErrorCode.sessionNotFound, `No session "${sessionId}".`);
  return created.payload;
}
