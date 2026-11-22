import type { PermissionOption, SessionSummary } from "@agentcontrol/protocol";

/** The one permission request a waiting session is blocked on. */
export type PendingPermission = {
  requestId: string;
  /** What the agent wants to do, for example "Run npm test". */
  title: string;
  options: readonly PermissionOption[];
};

/** One session in the list, with the workspace it runs on and an optional second line. */
export type SessionListEntry = {
  summary: SessionSummary;
  /** Display name of the workspace (machine) the session runs on. */
  workspace: string;
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
