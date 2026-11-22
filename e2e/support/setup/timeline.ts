import type { RequestPermissionRequest, SessionUpdate } from "@agentclientprotocol/sdk";

export type TimelineEntry =
  | { readonly kind: "update"; readonly update: SessionUpdate }
  | { readonly kind: "permission"; readonly request: RequestPermissionRequest };

interface Waiter {
  readonly matches: (entry: TimelineEntry) => boolean;
  readonly resolve: (entry: TimelineEntry) => void;
}

/** Everything the agent has told the client so far, in order, with waiting for what comes next. */
export class Timeline {
  readonly entries: TimelineEntry[] = [];
  private waiters: Waiter[] = [];

  record(entry: TimelineEntry): void {
    this.entries.push(entry);
    const ready = this.waiters.filter((w) => w.matches(entry));
    this.waiters = this.waiters.filter((w) => !ready.includes(w));
    ready.forEach((w) => {
      w.resolve(entry);
    });
  }

  /** Resolves with the first entry, already seen or still to come, that matches. */
  waitFor(matches: (entry: TimelineEntry) => boolean, describe: string): Promise<TimelineEntry> {
    const seen = this.entries.find(matches);
    if (seen) return Promise.resolve(seen);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${describe}, but it never happened`));
      }, 3000);
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
