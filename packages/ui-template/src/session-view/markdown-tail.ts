import { closeInline } from "./markdown-inline.ts";
import { insideFence } from "./markdown-lines.ts";
import { isRow } from "./markdown-table.ts";
import type { Block } from "./markdown-types.ts";

/** A line that is only the start of a block (`#`, `-`, `1.`, backticks, `|…`): what it is is not known yet. */
const MARKER_ONLY = /^(#{1,6}|[-*]|\d{1,9}[.)]?|`{1,3}|\*\*|\|.*)$/;
/** In code only a backtick line matters: it may be the start of the closing fence. */
const FENCE_START = /^`{1,3}$/;

const isMarkerOnly = (tail: string, closed: string): boolean =>
  MARKER_ONLY.test(tail.trim()) || MARKER_ONLY.test(closed.trim());

/**
 * The lines to show of a text that is still arriving. Its last line is not finished: a line that
 * is only a possible block marker is held back, and the rest is shown with its `code` and **bold**
 * closed, so that nothing shown has to change when the rest of the line comes.
 */
export function shownLines(lines: string[]): string[] {
  const tail = lines.at(-1) ?? "";
  const complete = lines.slice(0, -1);
  if (insideFence(complete)) return FENCE_START.test(tail.trim()) ? complete : lines;
  const closed = closeInline(tail);
  return isMarkerOnly(tail, closed) ? complete : [...complete, closed];
}

const endsInRow = (text: string): boolean => isRow(text.split("\n").at(-1) ?? "");

/** A last line of pipes that has no delimiter row below it yet is held back: it may be the header of a table. */
export function withoutDanglingRow(blocks: Block[]): Block[] {
  const last = blocks.at(-1);
  if (last?.type !== "paragraph" || !endsInRow(last.text)) return blocks;
  const rest = last.text.split("\n").slice(0, -1).join("\n");
  const before = blocks.slice(0, -1);
  return rest === "" ? before : [...before, { ...last, text: rest }];
}
