import { formatDuration } from "@agentcontrol/protocol";
import { useEffect, useState } from "react";
import type { ItemOf, StepView } from "./view-items.ts";

type Setup = ItemOf<"setup">;

/** How long it has been since `since`, counting up every second until unmounted. */
function RunningFor({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return <span>{formatDuration(Math.max(0, now - Date.parse(since)))}</span>;
}

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

/**
 * What starting (or archiving) a session did: one line that says how long it all took, which opens
 * into the steps, each with its own time, and the setup script's output.
 */
export function SetupOutput({ item }: { item: Setup }) {
  const open = item.phase === "archive" ? item.endedAt === undefined : item.exitCode !== 0;
  const going = item.endedAt === undefined && !hasFailed(item);
  return (
    <details className="rounded-lg border border-line text-xs" open={open}>
      <summary className="cursor-pointer px-2.5 py-1.5 text-muted">
        {headingOf(item)}
        {going && <TimeSoFar item={item} />}
      </summary>
      <StepList steps={item.steps} ticking={going} />
      {item.text !== "" && (
        <pre className="m-0 overflow-x-auto bg-code p-2.5 font-mono text-[11px]">{item.text}</pre>
      )}
    </details>
  );
}

/** How long it has been going, beside the heading, while there are steps to wait for. */
function TimeSoFar({ item }: { item: Setup }) {
  if (item.steps.length === 0) return null;
  return (
    <span className="ml-2 font-mono">
      <RunningFor since={item.startedAt} />
    </span>
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
