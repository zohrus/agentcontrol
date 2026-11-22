import type { UiVersion } from "../ui-versions/index.ts";
import { discardChange, keepChange, restoreVersion, undoChange } from "./actions.ts";
import { buildCtx } from "./build.ts";
import { type Ctx, restoreWaiting } from "./context.ts";
import { ModifyRefusal } from "./types.ts";
import { type Seed, seedUi } from "./seed.ts";
import { startRequest, startUpdate } from "./start.ts";
import type { ModifyOptions, ModifyState } from "./types.ts";

export type { ModifyConfig } from "./config.ts";
export { readModifyConfig } from "./config.ts";
export type { ModifyGate, ModifyStatus, ModifyUpdate, ModifyState } from "./types.ts";
export { ModifyRefusal } from "./types.ts";
export type { ModifyOptions } from "./types.ts";

/** The Modify agent: one request at a time from the user's words to Keep or Undo. */
export interface Modify {
  /** Creates the live and staging UI on first run and notes a newer default UI. Safe to repeat. */
  ready(): Promise<void>;
  state(): ModifyState;
  /** Starts a change; returns at once with the state, which then follows the work. */
  request(text: string): Promise<ModifyState>;
  /** Keep the change that is waiting (or finish the merged update). */
  keep(): Promise<ModifyState>;
  /** Undo the change that is waiting, or, with none waiting, the last kept one. */
  undo(): Promise<ModifyState>;
  /** Throws away the change in progress or the failed one. */
  discard(): Promise<ModifyState>;
  /** Saved versions of the UI, newest first. */
  history(): Promise<UiVersion[]>;
  /** Brings an earlier version back as a new one. */
  restore(commit: string): Promise<ModifyState>;
  /** Merges the available default-UI update; the result waits for Keep or Undo. */
  applyUpdate(): Promise<ModifyState>;
}

/** Seeds once, on the first call; a change that was waiting for Keep or Undo is brought back. */
function seedOnce(ctx: Ctx, seed: Seed): () => Promise<void> {
  let seeded: Promise<void> | undefined;
  return () => {
    seeded ??= seedUi(seed)
      .then((available) => {
        ctx.available = available;
        restoreWaiting(ctx);
      })
      .catch((error: unknown) => {
        seeded = undefined;
        throw error;
      });
    return seeded;
  };
}

/** Keep, Undo, Discard and Restore change the files: one at a time, so a double click acts once. */
function aloneIn(ctx: Ctx, act: (work: () => unknown) => Promise<ModifyState>) {
  return (work: () => Promise<unknown>) =>
    act(async () => {
      if (ctx.finishing) throw new ModifyRefusal("modify-busy", "Another action is still running.");
      ctx.finishing = true;
      try {
        await work();
      } finally {
        ctx.finishing = false;
      }
    });
}

export function createModify(options: ModifyOptions): Modify {
  const { ctx, seed } = buildCtx(options);
  const ready = seedOnce(ctx, seed);
  const act = async (work: () => unknown): Promise<ModifyState> => {
    await ready();
    await work();
    return ctx.state;
  };
  const alone = aloneIn(ctx, act);
  return {
    ready,
    state: () => ctx.state,
    request: (text) =>
      act(() => {
        startRequest(ctx, text);
      }),
    keep: () => alone(() => keepChange(ctx)),
    undo: () => alone(() => undoChange(ctx)),
    discard: () => alone(() => discardChange(ctx)),
    history: () => ctx.versions.history(),
    restore: (commit) => alone(() => restoreVersion(ctx, commit)),
    applyUpdate: () =>
      act(() => {
        startUpdate(ctx);
      }),
  };
}
