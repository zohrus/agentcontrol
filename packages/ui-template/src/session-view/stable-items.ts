import type { ViewItem } from "./view-items.ts";

type Fields = Record<string, unknown>;

/** Equal values, or lists of equal (by identity) values. */
function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }
  return a === b;
}

/** Whether two items show the same: every field equal, lists compared item by item. */
function sameItem(a: ViewItem, b: ViewItem): boolean {
  const x: Fields = a;
  const y: Fields = b;
  const keys = Object.keys(x);
  return keys.length === Object.keys(y).length && keys.every((key) => sameValue(x[key], y[key]));
}

/** A copy that later changes to the item (which the fold makes in place) do not reach. */
function snapshot(item: ViewItem): ViewItem {
  const fields: Fields = { ...item };
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) fields[key] = [...(value as unknown[])];
  }
  return fields as ViewItem;
}

/** The items by key, to find what an item looked like last time. */
export type Known = ReadonlyMap<string, ViewItem>;

/** Each item as a copy that is the very object of last time when nothing in it changed. */
export function publish(known: Known, items: readonly ViewItem[]): ViewItem[] {
  return items.map((item) => {
    const before = known.get(item.key);
    return before !== undefined && sameItem(before, item) ? before : snapshot(item);
  });
}

/** The items, each replaced by the one of last time when it shows the same. */
export function stabilise(known: Known, items: readonly ViewItem[]): ViewItem[] {
  return items.map((item) => {
    const before = known.get(item.key);
    return before !== undefined && sameItem(before, item) ? before : item;
  });
}

export const byKey = (items: readonly ViewItem[]): Known =>
  new Map(items.map((item) => [item.key, item]));
