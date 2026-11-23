import { Check, CircleAlert, Loader } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../components/index.ts";
import type { ChangeProgress } from "./types.ts";

type Status = ChangeProgress["status"];

const statusText: Record<Status, string> = {
  idle: "Describe a change to get started.",
  working: "Working on it…",
  checking: "Checking…",
  fixing: "Checks failed — sent back to the agent",
  ready: "Ready",
  failed: "The change could not be made",
};

const spinner = <Loader className="size-3.5 animate-spin text-run" />;
const alert = <CircleAlert className="size-3.5 text-fail" />;

const statusIcon: Record<Status, ReactNode> = {
  idle: null,
  working: spinner,
  checking: spinner,
  fixing: alert,
  ready: <Check className="size-3.5 text-done" />,
  failed: alert,
};

/** The change's status as one line, for example "Checking…". */
function StatusLine({ status }: { status: Status }) {
  return (
    <span role="status" className="flex items-center gap-1.5 text-xs text-muted">
      {statusIcon[status]}
      {statusText[status]}
    </span>
  );
}

export type ReviewBarProps = {
  status: Status;
  /** True when a kept version exists to go back to. */
  canGoBack: boolean;
  /** Keep and Undo are somewhere else (the update banner). */
  hideKeepUndo: boolean;
  onKeep: () => void;
  onUndo: () => void;
  onDiscard: () => void;
};

const discardable = new Set<Status>(["working", "checking", "fixing", "failed"]);

function KeepAndUndo({ status, canGoBack, onKeep, onUndo }: ReviewBarProps) {
  const idle = status === "idle";
  return (
    <>
      <Button onClick={onUndo} disabled={idle && !canGoBack}>
        {idle ? "Undo last change" : "Undo"}
      </Button>
      {!idle && (
        <Button variant="primary" onClick={onKeep}>
          Keep
        </Button>
      )}
    </>
  );
}

function Buttons(props: ReviewBarProps) {
  if (discardable.has(props.status)) return <Button onClick={props.onDiscard}>Discard</Button>;
  return props.hideKeepUndo ? null : <KeepAndUndo {...props} />;
}

/** The status line with the buttons that fit the moment: Discard, or Undo and Keep. */
export function ReviewBar(props: ReviewBarProps) {
  return (
    <div className="flex items-center gap-2 border-t border-line px-4 py-2">
      <StatusLine status={props.status} />
      <span className="flex-1" />
      <Buttons {...props} />
    </div>
  );
}
