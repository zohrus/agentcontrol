import type { RequestPermissionRequest, SessionUpdate } from "@agentclientprotocol/sdk";

export type TimelineEntry =
  | { readonly kind: "update"; readonly update: SessionUpdate }
  | { readonly kind: "permission"; readonly request: RequestPermissionRequest };

interface Waiter<T> {
  readonly matches: (entry: T) => boolean;
  readonly resolve: (entry: T) => void;
}

/** Everything one side has heard so far, in order, with waiting for what comes next. */
export class Timeline<T = TimelineEntry> {
  readonly entries: T[] = [];
  private waiters: Array<Waiter<T>> = [];

  constructor(private readonly timeoutMs = 3000) {}

  record(entry: T): void {
    this.entries.push(entry);
    const ready = this.waiters.filter((w) => w.matches(entry));
    this.waiters = this.waiters.filter((w) => !ready.includes(w));
    ready.forEach((w) => {
      w.resolve(entry);
    });
  }

  /** Resolves with the first entry, already seen or still to come, that matches. */
  waitFor(matches: (entry: T) => boolean, describe: string): Promise<T> {
    const seen = this.entries.find(matches);
    if (seen) return Promise.resolve(seen);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${describe}, but it never happened`));
      }, this.timeoutMs);
      this.waiters.push({
        matches,
        resolve: (entry) => {
          clearTimeout(timer);
          resolve(entry);
        },
      });
    });
  }
}
