import type { ConfigAgent, ConfigTarget, ScopedItem } from "@agentcontrol/sdk";
import {
  applyReviewed,
  clearFound,
  clearReview,
  findExisting,
  loadConfig,
  reviewChanges,
  saveItems,
  undoApplied,
} from "./config-data.ts";
import { keepManualEdit } from "./config-drift.ts";
import { type Context, succeeded } from "./context.ts";

/** What the user can do on the Config screen; each reports a failure itself and says if it worked. */
export function configActions(ctx: Context) {
  return {
    load: () => succeeded(ctx, () => loadConfig(ctx)),
    save: (items: readonly ScopedItem[]) => succeeded(ctx, () => saveItems(ctx, items)),
    review: (target: ConfigTarget) => succeeded(ctx, () => reviewChanges(ctx, target)),
    apply: () => succeeded(ctx, () => applyReviewed(ctx)),
    undo: async (force: boolean): Promise<boolean> => {
      let restored = false;
      const ok = await succeeded(ctx, async () => {
        restored = await undoApplied(ctx, force);
      });
      return ok && restored;
    },
    findExisting: (agents: readonly ConfigAgent[]) =>
      succeeded(ctx, () => findExisting(ctx, agents)),
    keepManualEdit: (call: { agent: ConfigAgent; itemIds: readonly string[] }) =>
      succeeded(ctx, () => keepManualEdit(ctx, call)),
    forgetFound: () => {
      clearFound(ctx);
    },
    forgetReview: () => {
      clearReview(ctx);
    },
  };
}
