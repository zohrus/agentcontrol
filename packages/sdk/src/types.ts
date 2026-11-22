import type { SessionSummary } from "@agentcontrol/protocol";

/** One session in the list: its summary plus the workspace it lives in. */
export type SessionRow = SessionSummary & { workspaceId: string };

export type {
  CheckStep,
  DiffFile,
  DiffResult,
  FsEntry,
  PermissionOption,
  RepoId,
  RepoInfo,
  RepoSetup,
  SessionEvent,
  SessionId,
  SessionStatus,
  SessionSummary,
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
