import { setTimeout as sleep } from "node:timers/promises";

/** A wait between reconnect attempts that ends early when the app is stopped or `wake` is called. */
export function wakeablePause() {
  // One controller per wait, made when the wait begins; `wake` always ends the current one.
  let early = new AbortController();
  return {
    pause: async (ms: number, signal: AbortSignal): Promise<void> => {
      early = new AbortController();
      const stop = AbortSignal.any([signal, early.signal]);
      await sleep(ms, undefined, { signal: stop }).catch(() => undefined);
    },
    wake: (): void => {
      early.abort();
    },
  };
}
