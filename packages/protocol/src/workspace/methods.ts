import { z } from "zod";
import { AgentKind, RepoId } from "../ids/index.ts";

const Empty = z.object({});

/** Params of relay/hello. */
export const HelloParams = z.object({ clientVersion: z.string() });
/** Result of relay/hello: the relay's version and the agents it can run. */
export const HelloResult = z.object({ relayVersion: z.string(), agents: z.array(AgentKind) });

/** One step of the workspace setup checklist. */
export const CheckStep = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(["ok", "failed", "skipped"]),
  detail: z.string().optional(),
});
/** Params of relay/workspace.check. */
export const WorkspaceCheckParams = Empty;
/** Result of relay/workspace.check. */
export const WorkspaceCheckResult = z.object({ steps: z.array(CheckStep) });

/** How a repo's worktrees are prepared: files to copy and an optional setup script. */
export const RepoSetup = z.object({
  copyFiles: z.array(z.string()).default([".env*"]),
  setupScript: z.string().optional(),
});
export type RepoSetup = z.infer<typeof RepoSetup>;

/** A repository registered with the relay. */
export const RepoInfo = z.object({
  repoId: RepoId,
  path: z.string(),
  defaultBranch: z.string(),
});
export type RepoInfo = z.infer<typeof RepoInfo>;

/** Params of relay/repos.add. */
export const ReposAddParams = z.object({ path: z.string() });
/** Params of relay/repos.list. */
export const ReposListParams = Empty;
/** Result of relay/repos.list: each repo with its worktree setup. */
export const ReposListResult = z.object({
  repos: z.array(RepoInfo.extend({ setup: RepoSetup })),
});

/** Params of relay/repos.setSetup. */
export const ReposSetSetupParams = z.object({ repoId: RepoId, setup: RepoSetup });
/** Result of relay/repos.setSetup. */
export const ReposSetSetupResult = Empty;
