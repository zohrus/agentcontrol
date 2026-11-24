import type { SessionEvent } from "@agentcontrol/protocol";
import type { ItemOf, StepView } from "./view-items.ts";
import { itemKey, type ViewState } from "./view-state.ts";

type Output = Extract<SessionEvent, { kind: "setup-output" }>;
type Finished = Extract<SessionEvent, { kind: "setup-finished" }>;
type Archived = Extract<SessionEvent, { kind: "session-archived" }>;
type Phase = ItemOf<"setup">["phase"];
type Stamp = { seq: number; ts: string };

/** The one block of the phase: setup (starting the session) or archive. Made by its first event. */
function setupItem(state: ViewState, call: { event: Stamp; phase: Phase }) {
  const { event, phase } = call;
  const found = state.items.find((item) => item.type === "setup" && item.phase === phase);
  if (found?.type === "setup") return found;
  const key = itemKey(phase, event.seq);
  const item = {
    type: "setup" as const,
    key,
    phase,
    text: "",
    exitCode: undefined,
    steps: [],
    startedAt: event.ts,
    endedAt: undefined,
  };
  state.items.push(item);
  return item;
}

/** A step that ended with no "running" line before it started its time ago. */
function startedAtOf(event: Stamp, durationMs: number | undefined): string {
  return new Date(Date.parse(event.ts) - (durationMs ?? 0)).toISOString();
}

function upsertStep(
  item: ItemOf<"setup">,
  call: { event: Stamp; step: NonNullable<Output["payload"]["step"]> },
) {
  const { event, step } = call;
  const view: StepView = {
    id: step.id,
    label: step.label,
    state: step.state,
    startedAt: startedAtOf(event, step.durationMs),
    durationMs: step.durationMs,
  };
  const at = item.steps.findIndex((known) => known.id === step.id);
  const known = item.steps[at];
  if (known === undefined) item.steps.push(view);
  else item.steps[at] = { ...view, startedAt: known.startedAt };
}

/** A step line updates its step; other output (the setup script's own) merges into one text block. */
export function reduceSetupOutput(state: ViewState, event: Output): void {
  const { step } = event.payload;
  const phase = step?.phase ?? "setup";
  const item = setupItem(state, { event, phase });
  if (step === undefined) item.text += event.payload.text;
  else upsertStep(item, { event, step });
  if (phase === "setup") extendToLastStep(item, event);
}

/** The agent opens its session after the script ends: a setup that has finished lasts until its last step. */
function extendToLastStep(item: ItemOf<"setup">, event: Output): void {
  const ended = item.endedAt !== undefined && event.payload.step?.state !== "running";
  if (ended) item.endedAt = event.ts;
}

export function reduceSetupFinished(state: ViewState, event: Finished): void {
  const item = setupItem(state, { event, phase: "setup" });
  item.exitCode = event.payload.exitCode;
  item.endedAt = event.ts;
}

/** The archive block ends when the session is archived; the deletion of its folder goes on after. */
export function reduceArchived(state: ViewState, event: Archived): void {
  const item = state.items.find((i) => i.type === "setup" && i.phase === "archive");
  if (item?.type === "setup") item.endedAt = event.ts;
}
