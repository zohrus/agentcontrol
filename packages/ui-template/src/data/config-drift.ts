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

/** The repositories the items are scoped to, each once; `undefined` stands for the global scope. */
const repoPathsOf = (items: readonly ScopedItem[]): (string | undefined)[] => [
  ...new Set(items.map((scoped) => scoped.scope.repoPath)),
];

/** What the agent's files hold now, for the global scope and for each repository asked about. */
async function importFor(
  ctx: Context,
  call: { agent: ConfigAgent; repoPaths: readonly (string | undefined)[] },
): Promise<ScopedItem[]> {
  const found = await Promise.all(
    call.repoPaths.map((repoPath) =>
      ctx.client.config.import({ agents: [call.agent], ...(repoPath && { repoPath }) }),
    ),
  );
  return found.flat();
}

/**
 * "Keep my manual edit": the items named take the contents the agent's file has now. The other
 * agent's file is not written until the user reviews and applies.
 */
export async function keepManualEdit(
  ctx: Context,
  call: { agent: ConfigAgent; itemIds: readonly string[] },
): Promise<void> {
  const wanted = (scoped: ScopedItem): boolean => call.itemIds.includes(scoped.item.id);
  const kept = ctx.store.get().config.items.filter(wanted);
  const found = await importFor(ctx, { agent: call.agent, repoPaths: repoPathsOf(kept) });
  await changeItems(ctx, (held) =>
    held.map((scoped) => (wanted(scoped) ? takingTheFile(scoped, found) : scoped)),
  );
}
