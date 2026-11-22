import { Check, CircleAlert, Loader } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../components/index.ts";
import type { CheckGate } from "./types.ts";

const statusText: Record<CheckGate, string> = {
  idle: "Describe a change to get started.",
  checking: "Checking…",
  failed: "Checks failed — sent back to the agent",
  ready: "Ready",
};

const statusIcon: Record<CheckGate, ReactNode> = {
  idle: null,
  checking: <Loader className="size-3.5 animate-spin text-run" />,
  failed: <CircleAlert className="size-3.5 text-fail" />,
  ready: <Check className="size-3.5 text-done" />,
};

/** The check gate's status as one line, for example "Checking…". */
function GateStatus({ gate }: { gate: CheckGate }) {
  return (
    <span role="status" className="flex items-center gap-1.5 text-xs text-muted">
      {statusIcon[gate]}
      {statusText[gate]}
    </span>
  );
}

type Props = { gate: CheckGate; onKeep: () => void; onUndo: () => void };

/** Gate status with the Keep and Undo buttons; Keep is available only when checks pass. */
export function ReviewBar({ gate, onKeep, onUndo }: Props) {
  return (
    <div className="flex items-center gap-2 border-t border-line px-4 py-2">
      <GateStatus gate={gate} />
      <span className="flex-1" />
      <Button onClick={onUndo} disabled={gate === "idle"}>
        Undo
      </Button>
      <Button variant="primary" onClick={onKeep} disabled={gate !== "ready"}>
        Keep
      </Button>
    </div>
  );
}
