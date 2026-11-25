import { formatDuration } from "@agentcontrol/protocol";
import { ChevronRight } from "lucide-react";
import { RunningFor } from "./running-for.tsx";
import type { ItemOf, StepView } from "./view-items.ts";

type Setup = ItemOf<"setup">;

const MARKS = { running: "…", done: "✓", failed: "✕" } as const;

/** How long a step took; for one that is still going, how long so far (unless the block has stopped). */
function StepTime({ step, ticking }: { step: StepView; ticking: boolean }) {
  if (step.durationMs !== undefined) return <>{formatDuration(step.durationMs)}</>;
  return ticking ? <RunningFor since={step.startedAt} /> : null;
}

function StepLine({ step, ticking }: { step: StepView; ticking: boolean }) {
  const failed = step.state === "failed";
  return (
    <li className={`flex gap-2 ${failed ? "text-del-fg" : ""}`} data-step-state={step.state}>
      <span aria-hidden className="w-3 text-center text-muted">
        {MARKS[step.state]}
      </span>
      <span className="flex-1">{step.label}</span>
      <span className="font-mono text-muted">
        <StepTime step={step} ticking={ticking} />
      </span>
    </li>
  );
}

/** The whole time from the first line to the last, as people waited for it. */
function total(item: Setup): string | undefined {
  if (item.endedAt === undefined) return undefined;
  return formatDuration(Date.parse(item.endedAt) - Date.parse(item.startedAt));
}

/** Archiving that has a failed step and no end will not go on: nothing about it is still running. */
const hasFailed = (item: Setup): boolean => item.steps.some((step) => step.state === "failed");

/** Whether the block ended badly: a step failed, or the setup script exited with an error. */
const isBad = (item: Setup): boolean =>
  hasFailed(item) || (item.exitCode !== undefined && item.exitCode !== 0);

function archiveHeading(item: Setup): string {
  if (item.endedAt !== undefined) return `Archived · ${total(item) ?? ""}`;
  return hasFailed(item) ? "Archiving failed" : "Archiving…";
}

function headingOf(item: Setup): string {
  const time = total(item);
  const withTime = (text: string): string => (time === undefined ? text : `${text} · ${time}`);
  if (item.phase === "archive") return archiveHeading(item);
  if (item.exitCode === undefined) return "Setting up the worktree…";
  if (item.exitCode === 0) return withTime("Worktree setup finished");
  return withTime(`Worktree setup failed (exit ${String(item.exitCode)})`);
}

/** The step the one-line summary names: the one that failed, else the one that runs now. */
function stepInFocus(item: Setup): StepView | undefined {
  const failed = item.steps.find((step) => step.state === "failed");
  return failed ?? item.steps.filter((step) => step.state === "running").at(-1);
}

/** After the heading: the step that is running (with how long so far) or that failed. */
function LiveStep({ item }: { item: Setup }) {
  const step = stepInFocus(item);
  if (step === undefined || item.endedAt !== undefined) return null;
  return (
    <>
      {" · "}
      {step.label} {step.state === "running" && <RunningFor since={step.startedAt} />}
    </>
  );
}

/**
 * What starting (or archiving) a session did: one line of fixed height that says what is going on
 * or how long it all took, and opens into the steps and the setup script's output. It starts
 * closed and stays as the user leaves it, whatever happens to the setup.
 */
export function SetupOutput({ item }: { item: Setup }) {
  const going = item.endedAt === undefined && !hasFailed(item);
  return (
    <details className="group rounded-lg border border-line text-xs">
      <summary
        className={`flex h-8 cursor-pointer items-center gap-1.5 px-2.5 ${isBad(item) ? "text-del-fg" : "text-muted"}`}
      >
        <ChevronRight className="size-3.5 flex-none transition-transform group-open:rotate-90" />
        <span className="min-w-0 flex-1 truncate">
          {headingOf(item)}
          <LiveStep item={item} />
        </span>
      </summary>
      <StepList steps={item.steps} ticking={going} />
      {item.text !== "" && (
        <pre className="m-0 max-h-60 overflow-auto bg-code p-2.5 font-mono text-[11px]">
          {item.text}
        </pre>
      )}
    </details>
  );
}

function StepList({ steps, ticking }: { steps: StepView[]; ticking: boolean }) {
  if (steps.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-0.5 px-2.5 py-1.5">
      {steps.map((step) => (
        <StepLine key={step.id} step={step} ticking={ticking} />
      ))}
    </ul>
  );
}
