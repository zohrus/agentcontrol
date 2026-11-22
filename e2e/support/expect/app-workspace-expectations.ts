import type { AgentKind } from "@agentcontrol/protocol";
import type { CheckStep, RepoWithSetup } from "@agentcontrol/sdk";
import type { AppAccess } from "../setup/app.ts";

/** The repo list holds the local repo, with this setup script when one is expected. */
export function expectRepoListed(
  app: AppAccess,
  call: { repos: RepoWithSetup[]; setupScript?: string },
): void {
  const repo = call.repos.find((candidate) => candidate.path === app.repoPath);
  if (!repo) throw new Error(`expected ${app.repoPath} to be a known repo, but it is not listed`);
  if (repo.setup.setupScript !== call.setupScript) {
    throw new Error(
      `expected the setup script of ${app.repoPath} to be ${String(call.setupScript)}, but it is ${String(repo.setup.setupScript)}`,
    );
  }
}

/** The workspace offers this agent. */
export function expectAgentOffered(agents: AgentKind[], agent: AgentKind): void {
  if (!agents.includes(agent)) {
    throw new Error(
      `expected the agent "${agent}" to be offered, but only ${agents.join(", ")} are`,
    );
  }
}

/** The checklist has a step with this id, and it passed. */
export function expectChecklistStepToPass(steps: CheckStep[], id: string): void {
  const step = steps.find((candidate) => candidate.id === id);
  if (step?.status !== "ok") {
    throw new Error(
      `expected checklist step "${id}" to be ok, but it is ${step?.status ?? "missing"}`,
    );
  }
}
