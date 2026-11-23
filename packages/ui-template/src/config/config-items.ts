import type { ScopedItem } from "@agentcontrol/protocol";
import { itemTitle } from "./item-title.ts";

/** An item is one per id and repository. */
const placeOf = (scoped: ScopedItem): string => `${scoped.item.id}|${scoped.scope.repoPath ?? ""}`;

/** The items with this one added, or in place of the one it replaces. */
export function withItem(call: {
  items: readonly ScopedItem[];
  scoped: ScopedItem;
  replaces?: ScopedItem | undefined;
}): ScopedItem[] {
  const gone = placeOf(call.replaces ?? call.scoped);
  const swapped = call.items.map((held) => (placeOf(held) === gone ? call.scoped : held));
  return call.items.some((held) => placeOf(held) === gone) ? swapped : [...call.items, call.scoped];
}

/** The items that are not already held, by id and scope; each place once. */
export function newOnes(held: readonly ScopedItem[], found: readonly ScopedItem[]): ScopedItem[] {
  const taken = new Set(held.map(placeOf));
  return found.filter((scoped) => {
    const fresh = !taken.has(placeOf(scoped));
    taken.add(placeOf(scoped));
    return fresh;
  });
}

/** What each item is called, by id. */
export const titlesOf = (items: readonly ScopedItem[]): Record<string, string> =>
  Object.fromEntries(items.map((scoped) => [scoped.item.id, itemTitle(scoped.item)]));

/** The repository whose own files a review should include: that of the first repo-scoped item. */
export const repoOf = (items: readonly ScopedItem[]): string | undefined =>
  items.find((scoped) => scoped.scope.repoPath !== undefined)?.scope.repoPath;

/** The items without this one. */
export const without = (items: readonly ScopedItem[], gone: ScopedItem): ScopedItem[] =>
  items.filter((held) => placeOf(held) !== placeOf(gone));

/** The items with this one switched on or off. */
export const toggled = (items: readonly ScopedItem[], one: ScopedItem): ScopedItem[] =>
  items.map((held) =>
    placeOf(held) === placeOf(one) ? { ...held, enabled: !held.enabled } : held,
  );
