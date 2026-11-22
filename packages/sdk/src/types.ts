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
