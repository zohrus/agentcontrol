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
  await pendingChanges(ctx);
  const [items, drift] = await Promise.all([ctx.client.config.list(), ctx.client.config.drift()]);
  holdConfig(ctx, { loaded: true, items, drift });
}

type Change = (items: readonly ScopedItem[]) => readonly ScopedItem[];

/** Changes to the items wait for the one before, so each starts from what the last one stored. */
const saving = new WeakMap<Context, Promise<unknown>>();

/** Resolves once every change made so far has been stored. */
async function pendingChanges(ctx: Context): Promise<void> {
  await (saving.get(ctx) ?? Promise.resolve()).catch(() => undefined);
}

/**
 * Changes the stored items (nothing is written to any agent's files). `change` is given the items
 * as they are when its turn comes, so quick successive changes never overwrite each other.
 */
export function changeItems(ctx: Context, change: Change): Promise<void> {
  const turn = (saving.get(ctx) ?? Promise.resolve())
    .catch(() => undefined)
    .then(async () => {
      const next = change(ctx.store.get().config.items);
      holdConfig(ctx, { items: await ctx.client.config.save([...next]) });
    });
  saving.set(ctx, turn);
  return turn;
}

/** Shows what applying the stored items would change in the agents' files, without writing. */
export async function reviewChanges(ctx: Context, target: ConfigTarget): Promise<void> {
  await pendingChanges(ctx);
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

/** The user declined to undo over files that changed since: the apply stays undoable. */
export function clearUndoBlock(ctx: Context): void {
  holdConfig(ctx, { undoBlockedBy: [] });
}

/** Forgets the last apply when the user goes back to editing; the review's notes stay in the list. */
export function clearReview(ctx: Context): void {
  holdConfig(ctx, { applied: undefined, undoBlockedBy: [] });
}
