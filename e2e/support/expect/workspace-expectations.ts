import type { WorkspaceCheckResult } from "@agentcontrol/protocol";

/** The workspace checklist reports git as installed and recent enough. */
export function expectGitToBeAvailable(check: WorkspaceCheckResult): void {
  const step = check.steps.find((candidate) => candidate.id === "git");
  if (step?.status === "ok") return;
  const found = step ? `${step.status}: ${step.detail ?? "no detail"}` : "no git step";
  throw new Error(`expected the workspace check to find git available, but it reports ${found}`);
}
