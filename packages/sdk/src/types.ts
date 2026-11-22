import type {
  PendingPermissionRequest,
  SessionEvent,
  SessionSummary,
} from "@agentcontrol/protocol";

/**
 * One session in the list: its summary plus the workspace it lives in. Session ids are only unique
 * within a workspace, so identify a session by `workspaceId` and `id` together.
 */
export interface SessionRow extends SessionSummary {
  /** The workspace (machine) the session runs on. */
  workspaceId: string;
  /**
   * True while a turn is open: a prompt was sent, the agent has not ended its turn, and it is still
   * running. Stays true while the turn waits for approval; use `status` and `waitingReason` for that.
   * Use it for a "working" indicator instead of working it out from events.
   */
  turnRunning: boolean;
  /**
   * The permission requests the agent is waiting on, oldest first, each with the options to answer
   * with (`sessions.answerPermission(id, requestId, optionId)`) and a short, agent-neutral view of
   * the action (`toolCall.title`, `kind`, `command` or `path`). Empty when nothing waits, and after
   * the agent exits or the relay restarts: nobody is left to answer.
   */
  pendingPermissions: PendingPermissionRequest[];
}

/** A session event as delivered on the live stream: the event plus the workspace it belongs to. */
export type LiveSessionEvent = SessionEvent & { workspaceId: string };

export type {
  AgentKind,
  CheckStep,
  DiffFile,
  DiffResult,
  FsEntry,
  PendingPermissionRequest,
  PendingToolCall,
  PermissionOption,
  RepoId,
  RepoInfo,
  RepoSetup,
  SessionEvent,
  SessionId,
  SessionStatus,
  SessionSummary,
  UsageRow,
  WaitingReason,
} from "@agentcontrol/protocol";

/**
 * What the agent did or said, normalised by the relay: read `payload.updates` of an "acp" event
 * (and `payload.tool` of a "permission-requested" event), never the raw `payload.message`.
 * Discriminated on `type`; the shapes and their doc comments live in `@agentcontrol/protocol`.
 */
export type {
  AgentUpdate,
  FileChange,
  PlanEntry,
  ToolDescription,
  ToolKind,
  ToolStatus,
} from "@agentcontrol/protocol";
