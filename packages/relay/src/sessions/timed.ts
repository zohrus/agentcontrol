import type { SessionId, SetupStep } from "@agentcontrol/protocol";
import { createTimed, finishedLine, type StepLine, type Timed } from "../steps/index.ts";
import type { SessionContext } from "./context.ts";

type Where = { sessionId: SessionId; phase: SetupStep["phase"] };

/** Appends the line to the session's log as a "setup-output" event. */
async function append(ctx: SessionContext, sessionId: SessionId, line: StepLine): Promise<void> {
  const { text, step } = line;
  await ctx.log.append(sessionId, {
    kind: "setup-output",
    payload: { stream: "stdout", text, step },
  });
}

/** Timed steps whose lines go into the session's log, in order, as "setup-output" events. */
export function timedFor(ctx: SessionContext, call: Where): Timed {
  const { sessionId, phase } = call;
  return createTimed({
    phase,
    stopwatch: ctx.stopwatch,
    report: (line) => append(ctx, sessionId, line),
  });
}

/**
 * Timed steps for work that goes on after the session's story is told (deleting an archived
 * session's folder): their lines are dropped once the relay stops, never written to a log that
 * may be gone.
 */
export function timedInBackground(ctx: SessionContext, call: Where): Timed {
  const { sessionId, phase } = call;
  return createTimed({
    phase,
    stopwatch: ctx.stopwatch,
    report: ({ text, step }) => {
      ctx.record(sessionId, { kind: "setup-output", payload: { stream: "stdout", text, step } });
      return Promise.resolve();
    },
  });
}

/** Says that a step ended after `durationMs`, for a step that was measured before it was known to be worth showing. */
export function reportFinished(
  ctx: SessionContext,
  call: Where & { id: string; label: string; durationMs: number },
): Promise<void> {
  return append(ctx, call.sessionId, finishedLine(call));
}
