import type {
  ConnectionState,
  PermissionOption,
  SessionId,
  SessionSummary,
} from "@agentcontrol/protocol";

/** A session is identified by its workspace and its id: ids are only unique within a workspace. */
export type SessionRef = { workspaceId: string; id: SessionId };

/** The workspace a session runs on, with its connection, as the list shows it. */
export type WorkspaceTag = {
  id: string;
  /** The name from the workspace record ("This Mac", or what the user called the host). */
  label: string;
  state: ConnectionState;
  /** Why the workspace is not connected, in plain words. */
  reason?: string | undefined;
};

/** The one permission request a waiting session is blocked on. */
export type PendingPermission = {
  requestId: string;
  /** What the agent wants to do, for example "Run npm test". */
  title: string;
  options: readonly PermissionOption[];
  /** The option chosen whose answer is on its way to the agent, when there is one. */
  answering?: string | undefined;
};

/** One session in the list, with the workspace it runs on and an optional second line. */
export type SessionListEntry = {
  summary: SessionSummary;
  /** Which workspace and id the session has. */
  ref: SessionRef;
  /** The workspace (machine) the session runs on. */
  workspace: WorkspaceTag;
  /** True when the workspace cannot take commands (offline, removed): the session can only be read. */
  readOnly: boolean;
  /** Second line of the row; defaults to the agent and status. */
  detail?: string;
  /**
   * Set only when exactly one permission request is pending: the row then shows Approve and
   * Deny buttons. With several pending requests, leave it unset so the user reviews them.
   */
  pendingPermission?: PendingPermission;
};

/** What a custom session row receives from the list. */
export type SessionRowProps = {
  entry: SessionListEntry;
  selected: boolean;
  onSelect: () => void;
  /** Answers the entry's pending permission request straight from the row. */
  onAnswerPermission?: ((requestId: string, optionId: string) => void) | undefined;
};
