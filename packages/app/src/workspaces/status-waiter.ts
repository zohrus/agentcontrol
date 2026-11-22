import type { ConnectionStatus } from "@agentcontrol/protocol";

const SETTLED = new Set<ConnectionStatus["state"]>(["connected", "offline", "needs-relay-update"]);

/** Whether the connection has reached a state that will not change without something happening. */
export const isSettled = (status: ConnectionStatus): boolean => SETTLED.has(status.state);

/** Lets callers wait for the next time a workspace's connection settles. */
export function statusWaiter() {
  const waiting = new Set<(status: ConnectionStatus) => void>();
  return {
    notify: (status: ConnectionStatus): void => {
      if (!isSettled(status)) return;
      waiting.forEach((resolve) => {
        resolve(status);
      });
      waiting.clear();
    },
    /** The next settled status, or `undefined` once `timeoutMs` has passed. */
    next: (timeoutMs: number): Promise<ConnectionStatus | undefined> =>
      new Promise((resolve) => {
        const timer = setTimeout(() => {
          waiting.delete(done);
          resolve(undefined);
        }, timeoutMs);
        const done = (status: ConnectionStatus): void => {
          clearTimeout(timer);
          resolve(status);
        };
        waiting.add(done);
      }),
  };
}

export type StatusWaiter = ReturnType<typeof statusWaiter>;
