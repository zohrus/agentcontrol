import { realStopwatch, type Stopwatch } from "./timed.ts";

/** Set to a number of milliseconds, every step reports exactly that long: for tests, never in use. */
const FIXED_VARIABLE = "AGENTCONTROL_STEP_MS";

/** The clock steps are timed with: the real one, unless the environment fixes every duration. */
export function stopwatchOf(env: Record<string, string | undefined>): Stopwatch {
  const fixed = Number(env[FIXED_VARIABLE]);
  if (env[FIXED_VARIABLE] === undefined || !Number.isInteger(fixed) || fixed < 0) {
    return realStopwatch;
  }
  return () => () => fixed;
}
