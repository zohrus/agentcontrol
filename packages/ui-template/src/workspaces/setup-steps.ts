import type { CheckStep } from "@agentcontrol/sdk";

/** One step of a setup as the dialog gets it (the same shape the data layer keeps). */
export type SetupStep = {
  id: string;
  label: string;
  state: "started" | "ok" | "failed";
  message: string;
};

/** The steps a setup announced, as checklist rows; the one that is still running has no result yet. */
export function checklistOf(steps: readonly SetupStep[]): CheckStep[] {
  return steps.map(({ id, label, state, message }) => ({
    id,
    label,
    status: state === "failed" ? "failed" : "ok",
    detail: message,
  }));
}

/** The step the setup is working on now, if any. */
export function runningStepOf(steps: readonly SetupStep[]): string | undefined {
  return steps.find((step) => step.state === "started")?.id;
}
