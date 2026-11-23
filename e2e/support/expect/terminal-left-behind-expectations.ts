import { type SleepingShell, shellsRunning } from "../setup/terminal-left-behind.ts";

/** Exactly this many shells of the program are running. */
export function expectShellsRunning(shell: SleepingShell, expected: number): void {
  const running = shellsRunning(shell);
  if (running === expected) return;
  throw new Error(
    `expected ${String(expected)} shell(s) to be running, but ${String(running)} are: one outlived its client`,
  );
}
