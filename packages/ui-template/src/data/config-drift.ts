import type { ConfigAgent, ConfigItem, ScopedItem } from "@agentcontrol/sdk";
import { saveItems } from "./config-data.ts";
import type { Context } from "./context.ts";

/** The same item as found in an agent's files: the same id, or the same kind and name. */
function isSameItem(held: ConfigItem, found: ConfigItem): boolean {
  if (held.kind !== found.kind) return false;
  if (held.id === found.id) return true;
  return "name" in held && "name" in found ? held.name === found.name : !("name" in held);
}

/** The held item with the contents the agent's file has now, under the id it already has. */
function takingTheFile(held: ScopedItem, found: readonly ScopedItem[]): ScopedItem {
  const hit = found.find((candidate) => isSameItem(held.item, candidate.item));
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
  const found = await ctx.client.config.import({ agents: [call.agent] });
  const held = ctx.store.get().config.items;
  const wanted = (scoped: ScopedItem): boolean => call.itemIds.includes(scoped.item.id);
  await saveItems(
    ctx,
    held.map((scoped) => (wanted(scoped) ? takingTheFile(scoped, found) : scoped)),
  );
}
