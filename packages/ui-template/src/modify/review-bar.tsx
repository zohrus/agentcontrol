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
  /** The action pressed whose answer has not come: its button says so, and none can be pressed. */
  pressed?: "keep" | "undo" | "discard" | "restore" | "update" | undefined;
};

const discardable = new Set<Status>(["working", "checking", "fixing", "failed"]);

type Pressed = ReviewBarProps["pressed"];

function UndoButton(props: Pick<ReviewBarProps, "status" | "canGoBack" | "onUndo" | "pressed">) {
  const idle = props.status === "idle";
  const label = idle ? "Undo last change" : "Undo";
  return (
    <Button
      onClick={props.onUndo}
      disabled={(idle && !props.canGoBack) || props.pressed !== undefined}
    >
      {props.pressed === "undo" ? "Undoing…" : label}
    </Button>
  );
}

function KeepButton({ onKeep, pressed }: { onKeep: () => void; pressed: Pressed }) {
  return (
    <Button variant="primary" onClick={onKeep} disabled={pressed !== undefined}>
      {pressed === "keep" ? "Keeping…" : "Keep"}
    </Button>
  );
}

function KeepAndUndo(props: ReviewBarProps) {
  return (
    <>
      <UndoButton {...props} />
      {props.status !== "idle" && <KeepButton onKeep={props.onKeep} pressed={props.pressed} />}
    </>
  );
}

function Buttons(props: ReviewBarProps) {
  if (discardable.has(props.status)) {
    return (
      <Button onClick={props.onDiscard} disabled={props.pressed !== undefined}>
        {props.pressed === "discard" ? "Discarding…" : "Discard"}
      </Button>
    );
  }
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
