import type {
  AgentKind,
  CheckStep,
  RepoId,
  RepoInfo,
  RepoSetup,
  WorkspaceInfo,
} from "@agentcontrol/protocol";
import { read } from "./api-error.ts";
import type { Api } from "./client-type.ts";

export type RepoWithSetup = RepoInfo & { setup: RepoSetup };

/** Which workspace a call is about; the local one ("This Mac") when left out. */
export interface InWorkspace {
  /** A workspace id from `workspaces.list()`. */
  workspaceId?: string;
}

const queryFor = ({ workspaceId }: InWorkspace) =>
  workspaceId === undefined ? {} : { workspace: workspaceId };

/** Repositories the workspace knows, and how new worktrees of each are prepared. */
export function reposApi(api: Api) {
  return {
    /** Registered repos with their worktree setup. */
    list: async (options: InWorkspace = {}): Promise<RepoWithSetup[]> => {
      const { repos } = await read(api.repos.$get({ query: queryFor(options) }));
      return repos;
    },
    /** Registers a git repo by its absolute path (a path on the workspace's machine). */
    add: (path: string, options: InWorkspace = {}): Promise<RepoInfo> =>
      read(api.repos.$post({ query: queryFor(options), json: { path } })),
    /** Sets the files to copy and the setup script that run in each new worktree of the repo. */
    setSetup: async (id: RepoId, setup: RepoSetup, options: InWorkspace = {}): Promise<void> => {
      const query = queryFor(options);
      await read(api.repos[":id"].setup.$put({ param: { id }, query, json: setup }));
    },
  };
}

/** The workspace's health checklist. */
export function workspaceApi(api: Api) {
  return {
    /**
     * One workspace (this Mac by default) with its connection state and relay version. The same
     * record `workspaces.list()` returns; it answers even while the relay is down.
     */
    get: (options: InWorkspace = {}): Promise<WorkspaceInfo> =>
      read(api.workspace.$get({ query: queryFor(options) })),
    /** Setup steps (git, agents, login) with ok / failed / skipped. */
    check: async (options: InWorkspace = {}): Promise<CheckStep[]> => {
      const { steps } = await read(api.workspace.check.$get({ query: queryFor(options) }));
      return steps;
    },
  };
}

/** The agents the workspace can run. */
export function agentsApi(api: Api) {
  return {
    /** The agents this workspace can run, e.g. "claude-code" and "codex". */
    list: async (options: InWorkspace = {}): Promise<AgentKind[]> => {
      const { agents } = await read(api.agents.$get({ query: queryFor(options) }));
      return agents;
    },
  };
}
