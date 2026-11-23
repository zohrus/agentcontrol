import { setTimeout as sleep } from "node:timers/promises";

/** A wait between reconnect attempts that ends early when the app is stopped or `wake` is called. */
export function wakeablePause() {
  let wakeNow = (): void => undefined;
  return {
    pause: async (ms: number, signal: AbortSignal): Promise<void> => {
      const early = new AbortController();
      wakeNow = () => {
        early.abort();
      };
      const stop = AbortSignal.any([signal, early.signal]);
      await sleep(ms, undefined, { signal: stop }).catch(() => undefined);
    },
    wake: (): void => {
      wakeNow();
    },
  };
}
