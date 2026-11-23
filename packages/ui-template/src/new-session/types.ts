import type { AgentKind, RepoInfo } from "@agentcontrol/protocol";

/** What the user asked for when pressing Start. */
export type NewSessionRequest = {
  agent: AgentKind;
  repoPath: string;
  baseBranch: string;
  prompt: string;
};

export type NewSessionDialogProps = {
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
