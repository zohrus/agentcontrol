import type { ConfigAgent, ConfigItem, ScopedItem } from "@agentcontrol/sdk";
import { changeItems } from "./config-data.ts";
import type { Context } from "./context.ts";

/** The same item as found in an agent's files: the same id, or the same kind and name. */
function isSameItem(held: ConfigItem, found: ConfigItem): boolean {
  if (held.kind !== found.kind) return false;
  if (held.id === found.id) return true;
  return "name" in held && "name" in found ? held.name === found.name : !("name" in held);
}

/** Found items of the same scope that are the held item: the one with its id first, else by name. */
function matchesOf(held: ScopedItem, found: readonly ScopedItem[]): ScopedItem | undefined {
  const here = found.filter((candidate) => candidate.scope.repoPath === held.scope.repoPath);
  const same = here.filter((candidate) => isSameItem(held.item, candidate.item));
  return same.find((candidate) => candidate.item.id === held.item.id) ?? same[0];
}

/** The held item with the contents the agent's file has now, under the id it already has. */
function takingTheFile(held: ScopedItem, found: readonly ScopedItem[]): ScopedItem {
  const hit = matchesOf(held, found);
  return hit ? { ...held, item: { ...hit.item, id: held.item.id } } : held;
}

/**
 * "Keep my manual edit": the items named take the contents the agent's file has now. The other
 * agent's file is not written until the user reviews and applies.
 */
export async function keepManualEdit(
  ctx: Context,
  call: { agent: ConfigAgent; itemIds: readonly string[] },
): Promise<void> {
  const repoPath = ctx.store.get().config.items.find((s) => s.scope.repoPath)?.scope.repoPath;
  const target = repoPath === undefined ? {} : { repoPath };
  const found = await ctx.client.config.import({ agents: [call.agent], ...target });
  const wanted = (scoped: ScopedItem): boolean => call.itemIds.includes(scoped.item.id);
  await changeItems(ctx, (held) =>
    held.map((scoped) => (wanted(scoped) ? takingTheFile(scoped, found) : scoped)),
  );
}
