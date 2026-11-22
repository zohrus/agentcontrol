import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Change, ModifyState } from "./types.ts";

/** What survives a restart: a promoted change that is still waiting for Keep or Undo. */
interface Saved {
  state: ModifyState;
  change: Omit<Change, "generation" | "preface">;
}

export interface Persist {
  /** Writes the state when it is `ready`; any other state removes what was written. */
  save(state: ModifyState, change: Change): void;
  /** The waiting change saved by an earlier run, if any. */
  load(): Saved | undefined;
}

/** Keeps the waiting change in `<dataDir>/modify-waiting.json`; small, so written synchronously. */
export function persistIn(dataDir: string): Persist {
  const file = join(dataDir, "modify-waiting.json");
  return {
    save: (state, change) => {
      if (state.status !== "ready") {
        rmSync(file, { force: true });
        return;
      }
      const { kind, requests, title, merge, baseCommit } = change;
      const kept = {
        ...{ kind, requests, title },
        ...(merge ? { merge } : {}),
        ...(baseCommit === undefined ? {} : { baseCommit }),
      };
      writeFileSync(file, JSON.stringify({ state, change: kept } satisfies Saved));
    },
    load: () => {
      try {
        return JSON.parse(readFileSync(file, "utf8")) as Saved;
      } catch {
        return undefined;
      }
    },
  };
}
