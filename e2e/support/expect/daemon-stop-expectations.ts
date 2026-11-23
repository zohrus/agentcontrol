interface Ended {
  exitCode: number;
  output: string;
}

/** The command ended well and its output says this. */
export function expectStopToSucceedSaying(ended: Ended, text: string): void {
  if (ended.exitCode !== 0 || !ended.output.includes(text)) {
    throw new Error(
      `expected stop to succeed saying "${text}", but it exited ${String(ended.exitCode)} printing "${ended.output.trim()}"`,
    );
  }
}

/** The command exited with an error and its output says this. */
export function expectStopToFailSaying(ended: Ended, text: string): void {
  if (ended.exitCode === 0 || !ended.output.includes(text)) {
    throw new Error(
      `expected stop to fail saying "${text}", but it exited ${String(ended.exitCode)} printing "${ended.output.trim()}"`,
    );
  }
}

/** The process is gone. */
export async function expectProcessToBeGone(
  folder: { isRunning(pid: number): boolean },
  pid: number,
): Promise<void> {
  if (folder.isRunning(pid))
    throw new Error(`expected the relay (process ${String(pid)}) to be gone, but it still runs`);
  await Promise.resolve();
}
