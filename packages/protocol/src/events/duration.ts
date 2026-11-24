/**
 * A duration as people read it: "340 ms", "2.1 s", "41 s", "2 min 5 s". The relay writes it into
 * the lines of its setup steps and the UI writes it for the step that is still running, so both
 * say the same thing.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${String(Math.round(ms))} ms`;
  if (ms < 9950) return `${(ms / 1000).toFixed(1)} s`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${String(seconds)} s`;
  return `${String(Math.floor(seconds / 60))} min ${String(seconds % 60)} s`;
}
