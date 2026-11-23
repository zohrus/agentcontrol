import { once } from "node:events";
import type { ConnectionStatus } from "@agentcontrol/protocol";

const SETTLED = new Set<ConnectionStatus["state"]>(["connected", "offline", "needs-relay-update"]);

/** Whether the connection has reached a state that will not change without something happening. */
const isSettled = (status: ConnectionStatus): boolean => SETTLED.has(status.state);

/** Lets callers wait for the next time a workspace's connection settles. */
export function statusWaiter() {
  const waiting = new Set<(status: ConnectionStatus) => void>();
  let signalNeedsUpdate = (): void => undefined;
  const needsUpdate = new Promise<void>((resolve) => {
    signalNeedsUpdate = resolve;
  });
  return {
    /** Resolves the first time the relay is found to be of another version than the app. */
    needsUpdate,
    notify: (status: ConnectionStatus): void => {
      if (status.state === "needs-relay-update") signalNeedsUpdate();
      if (!isSettled(status)) return;
      waiting.forEach((resolve) => {
        resolve(status);
      });
      waiting.clear();
    },
    /** The next settled status, or `undefined` once `timeoutMs` has passed. */
    next: (timeoutMs: number): Promise<ConnectionStatus | undefined> => {
      const settled = new Promise<ConnectionStatus>((resolve) => waiting.add(resolve));
      const timedOut = once(AbortSignal.timeout(timeoutMs), "abort").then(() => undefined);
      return Promise.race([settled, timedOut]);
    },
  };
}

export type StatusWaiter = ReturnType<typeof statusWaiter>;
