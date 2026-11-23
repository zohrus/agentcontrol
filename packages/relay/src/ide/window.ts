/** How many bytes may be on their way to a reader that has not said it handled them yet. */
export interface Window {
  /** Resolves when `bytes` more may be sent; the first piece always passes, however big. */
  take(bytes: number): Promise<void>;
  /** The reader handled `bytes`. */
  give(bytes: number): void;
  /** Nobody is waiting for more: every pending and later `take` resolves at once. */
  end(): void;
}

/** A credit window of `limit` bytes: the sender waits instead of piling data up in memory. */
export function createWindow(limit: number): Window {
  let inFlight = 0;
  let ended = false;
  let waiting: (() => void)[] = [];
  const wake = (): void => {
    const pending = waiting;
    waiting = [];
    pending.forEach((resume) => {
      resume();
    });
  };
  return {
    take: async (bytes) => {
      while (!ended && inFlight > 0 && inFlight + bytes > limit) {
        await new Promise<void>((resume) => waiting.push(resume));
      }
      inFlight += bytes;
    },
    give: (bytes) => {
      inFlight = Math.max(0, inFlight - bytes);
      wake();
    },
    end: () => {
      ended = true;
      wake();
    },
  };
}
