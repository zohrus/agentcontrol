import type { Block } from "./markdown-types.ts";

/** Equal values; lists are equal when their items are. */
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => same(value, b[index]));
  }
  return a === b;
}

/** Whether two blocks show the same, so that the view need not be drawn again. */
export function sameBlock(a: Block, b: Block): boolean {
  const x: Record<string, unknown> = a;
  const y: Record<string, unknown> = b;
  const keys = Object.keys(x);
  return keys.length === Object.keys(y).length && keys.every((key) => same(x[key], y[key]));
}
