import type { CheckStep, RepoId, RepoInfo, RepoSetup } from "@agentcontrol/protocol";

/** A registered repository together with how its worktrees are prepared. */
export type RepoWithSetup = RepoInfo & { setup: RepoSetup };

export type WorkspaceSetupProps = {
  /** The result of the last check, in order. */
  steps: readonly CheckStep[];
  /** While a check runs, the step being tried now (shown as running). */
  runningStepId?: string | undefined;
  /** True while "Check and repair" is running. */
  checking: boolean;
  repos: readonly RepoWithSetup[];
  onRecheck: () => void;
  onSaveSetup: (repoId: RepoId, setup: RepoSetup) => void;
};

/** What a step looks like: its result, or "running" while it is being tried. */
export type StepState = CheckStep["status"] | "running";
