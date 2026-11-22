import type { CheckStep, WorkspaceCheckResult } from "@agentcontrol/protocol";

interface Wanted {
  id: string;
  status: "ok" | "failed" | "skipped";
  saying: string;
}

const satisfies = (step: CheckStep | undefined, wanted: Wanted): boolean =>
  step?.status === wanted.status && (step.detail ?? "").includes(wanted.saying);

/** The workspace checklist has this step with this status, and its detail mentions `saying`. */
export function expectChecklistStep(check: WorkspaceCheckResult, wanted: Wanted): void {
  const step = check.steps.find((candidate) => candidate.id === wanted.id);
  if (satisfies(step, wanted)) return;
  const found = step ? `${step.status}: ${step.detail ?? "no detail"}` : "no such step";
  throw new Error(
    `expected checklist step "${wanted.id}" to be ${wanted.status} saying "${wanted.saying}", but it is ${found}`,
  );
}

/** The workspace checklist reports git as installed and recent enough. */
export function expectGitToBeAvailable(check: WorkspaceCheckResult): void {
  const step = check.steps.find((candidate) => candidate.id === "git");
  if (step?.status === "ok") return;
  const found = step ? `${step.status}: ${step.detail ?? "no detail"}` : "no git step";
  throw new Error(`expected the workspace check to find git available, but it reports ${found}`);
}
