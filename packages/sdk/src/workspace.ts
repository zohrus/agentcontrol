import type { AgentKind, CheckStep, RepoId, RepoInfo, RepoSetup } from "@agentcontrol/protocol";
import { read } from "./api-error.ts";
import type { Api } from "./client-type.ts";

export type RepoWithSetup = RepoInfo & { setup: RepoSetup };

/** A workspace and the state of the app's link to its relay. */
export interface WorkspaceInfo {
  id: string;
  label: string;
  kind: "local" | "ssh";
  connection: "connected" | "disconnected";
}

/** Repositories the workspace knows, and how new worktrees of each are prepared. */
export function reposApi(api: Api) {
  return {
    /** Registered repos with their worktree setup. */
    list: async (): Promise<RepoWithSetup[]> => {
      const { repos } = await read(api.repos.$get());
      return repos;
    },
    /** Registers a git repo by its absolute path. */
    add: (path: string): Promise<RepoInfo> => read(api.repos.$post({ json: { path } })),
    /** Sets the files to copy and the setup script that run in each new worktree of the repo. */
    setSetup: async (id: RepoId, setup: RepoSetup): Promise<void> => {
      await read(api.repos[":id"].setup.$put({ param: { id }, json: setup }));
    },
  };
}

/** The workspace's health checklist. */
export function workspaceApi(api: Api) {
  return {
    /** The workspace and whether the app can reach its relay right now. */
    get: (): Promise<WorkspaceInfo> => read(api.workspace.$get()),
    /** Setup steps (git, agents, login) with ok / failed / skipped. */
    check: async (): Promise<CheckStep[]> => {
      const { steps } = await read(api.workspace.check.$get());
      return steps;
    },
  };
}

/** The agents the workspace can run. */
export function agentsApi(api: Api) {
  return {
    /** The agents this workspace can run, e.g. "claude-code" and "codex". */
    list: async (): Promise<AgentKind[]> => {
      const { agents } = await read(api.agents.$get());
      return agents;
    },
  };
}
