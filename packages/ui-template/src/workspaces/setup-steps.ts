import type { CheckStep } from "@agentcontrol/sdk";
import type { SetupStep } from "../data/index.ts";

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
