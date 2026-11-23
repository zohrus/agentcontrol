import type { ConfigAgent, ConfigTarget, ScopedItem } from "@agentcontrol/sdk";
import type { Context } from "./context.ts";
import type { ConfigState } from "./model.ts";

function holdConfig(ctx: Context, change: Partial<ConfigState>): void {
  ctx.store.update((s) => ({ ...s, config: { ...s.config, ...change } }));
}

/** Compares every managed entry on disk with what the app last wrote. */
async function loadDrift(ctx: Context): Promise<void> {
  holdConfig(ctx, { drift: await ctx.client.config.drift() });
}

/** The items the app holds and whether any file was edited by hand; on opening the Config screen. */
export async function loadConfig(ctx: Context): Promise<void> {
  const [items] = await Promise.all([ctx.client.config.list(), loadDrift(ctx)]);
  holdConfig(ctx, { loaded: true, items });
}

/** Stores the items in the app (nothing is written to any agent's files). */
export async function saveItems(ctx: Context, items: readonly ScopedItem[]): Promise<void> {
  holdConfig(ctx, { items: await ctx.client.config.save([...items]) });
}

/** Shows what applying the stored items would change in the agents' files, without writing. */
export async function reviewChanges(ctx: Context, target: ConfigTarget): Promise<void> {
  holdConfig(ctx, { plan: await ctx.client.config.plan(target) });
}

/** Writes the reviewed plan; the result says what was written and is what "Undo" needs. */
export async function applyReviewed(ctx: Context): Promise<void> {
  const { plan } = ctx.store.get().config;
  if (plan === undefined) return;
  const applied = await ctx.client.config.apply(plan.planId);
  holdConfig(ctx, { applied, plan: undefined, undoBlockedBy: [] });
  await loadDrift(ctx);
}

/**
 * Puts the files of the last apply back. When files changed after it, nothing is restored and they
 * are listed for the user to confirm; `force` restores anyway. Says whether files were restored.
 */
export async function undoApplied(ctx: Context, force: boolean): Promise<boolean> {
  const { applied } = ctx.store.get().config;
  if (applied === undefined) return false;
  const result = await ctx.client.config.rollback(applied.backupId, force ? { force } : {});
  if (result.changedSince.length > 0 && !force) {
    holdConfig(ctx, { undoBlockedBy: result.changedSince });
    return false;
  }
  holdConfig(ctx, { applied: undefined, undoBlockedBy: [] });
  await loadDrift(ctx);
  return true;
}

/** Reads what each agent already has, one agent at a time, so the user sees whose it is. */
export async function findExisting(ctx: Context, agents: readonly ConfigAgent[]): Promise<void> {
  const found = await Promise.all(
    agents.map(async (agent) => ({
      agent,
      items: await ctx.client.config.import({ agents: [agent] }),
    })),
  );
  holdConfig(ctx, { found });
}

/** Forgets what the last "Import existing setup" found. */
export function clearFound(ctx: Context): void {
  holdConfig(ctx, { found: undefined });
}

/** Forgets the last apply when the user goes back to editing; the review's notes stay in the list. */
export function clearReview(ctx: Context): void {
  holdConfig(ctx, { applied: undefined, undoBlockedBy: [] });
}
