/** Runs `task` at most once per burst of `request()` calls, and never two runs at the same time. */
export interface Coalescer {
  request: () => void;
  /** Runs the task now (after any run in progress) and resolves when it has finished. */
  runNow: () => Promise<void>;
}

export function createCoalescer(options: {
  delayMs: number;
  task: () => Promise<void>;
}): Coalescer {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> = Promise.resolve();
  const runNow = (): Promise<void> => {
    clearTimeout(timer);
    timer = undefined;
    running = running.then(options.task).catch(() => undefined);
    return running;
  };
  return {
    runNow,
    request: () => {
      timer ??= setTimeout(() => void runNow(), options.delayMs);
    },
  };
}
