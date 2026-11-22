import { type AgentKind, CheckStep, RepoId, RepoInfo, RepoSetup } from "@agentcontrol/protocol";
import type { RepoWithSetup } from "../workspace-setup/index.ts";

/** EXAMPLE DATA: repositories, agents and the workspace check shown by the setup dialogs. */
export const exampleAgents: AgentKind[] = ["claude-code", "codex"];

const repoRows = [
  {
    id: "api",
    path: "~/code/api",
    defaultBranch: "main",
    setup: { copyFiles: [".env*", "config/*.local.json"], setupScript: "npm install" },
  },
  { id: "web", path: "~/code/web", defaultBranch: "develop", setup: { copyFiles: [".env*"] } },
];

export const exampleRepos: RepoWithSetup[] = repoRows.map((row) => ({
  ...RepoInfo.parse({
    repoId: RepoId.parse(row.id),
    path: row.path,
    defaultBranch: row.defaultBranch,
  }),
  setup: RepoSetup.parse(row.setup),
}));

export const exampleCheckSteps: CheckStep[] = [
  { id: "relay", label: "Relay is running", status: "ok", detail: "Version 0.1.0 answered." },
  { id: "git", label: "Git is installed", status: "ok", detail: "git 2.47 found." },
  {
    id: "claude",
    label: "Claude Code is signed in",
    status: "failed",
    detail: "Not signed in. Run “claude login” in a terminal, then check again.",
  },
  {
    id: "codex",
    label: "Codex is installed",
    status: "skipped",
    detail: "Not used by this workspace.",
  },
  {
    id: "repos",
    label: "Repositories are reachable",
    status: "ok",
    detail: "2 repositories found.",
  },
].map((step) => CheckStep.parse(step));
