import type { SessionStatus } from "@agentcontrol/protocol";
import { cn } from "../components/index.ts";
import { type DotKind, dotKind } from "./labels.ts";

const dotClasses: Record<DotKind, string> = {
  run: "bg-run animate-pulse",
  wait: "bg-wait",
  done: "bg-done",
  fail: "bg-fail",
  idle: "bg-muted",
};

export function StatusDot({ status }: { status: SessionStatus }) {
  return (
    <i
      role="img"
      aria-label={status}
      className={cn("inline-block size-2 flex-none rounded-full", dotClasses[dotKind(status)])}
    />
  );
}
