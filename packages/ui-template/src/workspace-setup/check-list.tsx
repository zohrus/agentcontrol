import type { CheckStep } from "@agentcontrol/protocol";
import { Check, Loader, Minus, X } from "lucide-react";
import type { ReactNode } from "react";
import type { StepState } from "./types.ts";

const icons: Record<StepState, ReactNode> = {
  ok: <Check className="size-4 text-done" />,
  failed: <X className="size-4 text-fail" />,
  skipped: <Minus className="size-4 text-muted" />,
  running: <Loader className="size-4 animate-spin text-run" />,
};

const stateNames: Record<StepState, string> = {
  ok: "Passed",
  failed: "Failed",
  skipped: "Skipped",
  running: "Checking",
};

function StepIcon({ state }: { state: StepState }) {
  return (
    <span role="img" aria-label={stateNames[state]} className="mt-0.5 flex-none">
      {icons[state]}
    </span>
  );
}

type Props = { steps: readonly CheckStep[]; runningStepId: string | undefined };

/** The checklist: one row per step with its status icon, name and plain-language detail. */
export function CheckList({ steps, runningStepId }: Props) {
  return (
    <ol className="m-0 flex list-none flex-col gap-2 p-0">
      {steps.map((step) => (
        <li key={step.id} className="flex items-start gap-2.5">
          <StepIcon state={step.id === runningStepId ? "running" : step.status} />
          <div className="flex min-w-0 flex-col">
            <span className="font-medium">{step.label}</span>
            {step.detail && <span className="text-xs text-muted">{step.detail}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}
