import { formatDuration, type SetupStep } from "@agentcontrol/protocol";

/** Starts a stopwatch; the function it returns says how many milliseconds have passed since. */
export type Stopwatch = () => () => number;

/** One timed step: what it is called while it runs, and what it is called once it is done. */
interface StepSpec<Result> {
  id: string;
  /** Present tense, no ending: "Fetching origin/main". */
  doing: string;
  /** Past tense, no time: "Fetched origin/main"; may depend on what the work found. */
  done: string | ((result: Result) => string);
}

/** Runs the work as a step that announces itself, and says how long it took when it ends. */
export type Timed = <Result>(
  spec: StepSpec<Result>,
  work: () => Promise<Result>,
) => Promise<Result>;

/** One line about a step: its words for the setup output, and the step itself. */
export interface StepLine {
  text: string;
  step: SetupStep;
}

/** Runs the work with nothing said about it, for callers that do not show steps. */
export const untimed: Timed = (_spec, work) => work();

/** The real clock. */
export const realStopwatch: Stopwatch = () => {
  const started = performance.now();
  return () => Math.round(performance.now() - started);
};

function lineOf(options: {
  phase: SetupStep["phase"];
  id: string;
  state: SetupStep["state"];
  label: string;
  durationMs?: number;
}): StepLine {
  const { durationMs, label } = options;
  const text = durationMs === undefined ? label : `${label} · ${formatDuration(durationMs)}`;
  const step: SetupStep = { ...options, ...(durationMs === undefined ? {} : { durationMs }) };
  return { text: `${text}\n`, step };
}

/** The line for a step that already ended, for one whose time was measured before it was known to be worth showing. */
export function finishedLine(call: {
  phase: SetupStep["phase"];
  id: string;
  label: string;
  durationMs: number;
}): StepLine {
  return lineOf({ ...call, state: "done" });
}

/**
 * A `Timed` that reports each step twice: when it starts ("running") and when it ends ("done", or
 * "failed" with the error rethrown), with the time the stopwatch measured. Reports are awaited, so
 * they reach the log in order.
 */
export function createTimed(options: {
  phase: SetupStep["phase"];
  stopwatch: Stopwatch;
  report: (line: StepLine) => Promise<void>;
}): Timed {
  const { phase, stopwatch, report } = options;
  return async (spec, work) => {
    const elapsed = stopwatch();
    const { id, doing } = spec;
    await report(lineOf({ phase, id, state: "running", label: `${doing}…` }));
    // Only the work can fail the step: a line that cannot be reported is not the work's failure.
    const result = await work().catch(async (error: unknown) => {
      const failed = lineOf({
        phase,
        id,
        state: "failed",
        label: `${doing} failed`,
        durationMs: elapsed(),
      });
      await report(failed);
      throw error;
    });
    const label = typeof spec.done === "function" ? spec.done(result) : spec.done;
    await report(lineOf({ phase, id, state: "done", label, durationMs: elapsed() }));
    return result;
  };
}
