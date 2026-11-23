import type { AgentKind, RepoInfo } from "@agentcontrol/protocol";

/** What the user asked for when pressing Start. */
export type NewSessionRequest = {
  /** The workspace (machine) the session runs on. */
  workspaceId: string;
  agent: AgentKind;
  repoPath: string;
  baseBranch: string;
  prompt: string;
};

/** A machine a session can be started on. */
export type WorkspaceChoice = { id: string; label: string; connected: boolean };

export type NewSessionDialogProps = {
  /** Where sessions can run; the choice is only offered when there is more than one. */
  workspaces: readonly WorkspaceChoice[];
  /** The chosen workspace, whose repositories and agents `repos` and `agents` are. */
  workspaceId: string;
  onWorkspaceChange: (id: string) => void;
  /** False while the chosen workspace's repositories and agents are still being loaded. */
  ready: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repos: readonly RepoInfo[];
  agents: readonly AgentKind[];
  onStart: (request: NewSessionRequest) => void;
  /**
   * The user typed a folder path under "Add repository…". The new repo should appear in `repos`;
   * resolves to its path, or to undefined when it could not be added (the user has been told).
   */
  onAddRepository: (path: string) => Promise<string | undefined>;
};
