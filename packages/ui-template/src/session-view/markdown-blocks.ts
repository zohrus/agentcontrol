import { BULLET, FENCE, HEADING, splitLines } from "./markdown-lines.ts";
import { startsTable, table } from "./markdown-table.ts";
import { shownLines, withoutDanglingRow } from "./markdown-tail.ts";
import type { Block, Read, Shape } from "./markdown-types.ts";

export type { Block } from "./markdown-types.ts";
export { parseInline, type Span } from "./markdown-inline.ts";

const fence: Read = (lines, at) => {
  const open = FENCE.exec(lines[at] ?? "");
  if (!open) return undefined;
  const close = lines.findIndex((line, index) => index > at && line.trim() === "```");
  const end = close === -1 ? lines.length : close;
  const text = lines.slice(at + 1, end).join("\n");
  return { block: { type: "code", lang: open[1] ?? "", text }, next: end + 1 };
};

const heading: Read = (lines, at) => {
  const found = HEADING.exec(lines[at] ?? "");
  if (!found) return undefined;
  return {
    block: { type: "heading", level: (found[1] ?? "").length, text: found[2] ?? "" },
    next: at + 1,
  };
};

const list: Read = (lines, at) => {
  const stop = lines.findIndex((line, index) => index >= at && !BULLET.test(line));
  const end = stop === -1 ? lines.length : stop;
  const items = lines.slice(at, end).map((line) => BULLET.exec(line)?.[1] ?? "");
  return end === at ? undefined : { block: { type: "list", items }, next: end };
};

const isBlank = (lines: string[], at: number): boolean => (lines[at] ?? "").trim() === "";
const isFence = (lines: string[], at: number): boolean => FENCE.test(lines[at] ?? "");
const isHeading = (lines: string[], at: number): boolean => HEADING.test(lines[at] ?? "");
const isBullet = (lines: string[], at: number): boolean => BULLET.test(lines[at] ?? "");

const startsOtherBlock = (lines: string[], at: number): boolean =>
  [isBlank, isFence, isHeading, isBullet, startsTable].some((test) => test(lines, at));

/** Consecutive lines up to the next blank line or block, line breaks kept. */
const paragraph: Read = (lines, at) => {
  let end = at + 1;
  while (end < lines.length && !startsOtherBlock(lines, end)) end++;
  return { block: { type: "paragraph", text: lines.slice(at, end).join("\n") }, next: end };
};

const readers: Read[] = [fence, heading, table, list, paragraph];

function readBlock(lines: string[], at: number): { block: Shape; next: number } {
  for (const read of readers) {
    const found = read(lines, at);
    if (found) return found;
  }
  return { block: { type: "paragraph", text: lines[at] ?? "" }, next: at + 1 };
}

/**
 * Splits an agent's reply into blocks; an unclosed code fence runs to the end, as while it streams.
 * While the reply is still arriving (`final` false) only what cannot change its look is shown: see
 * `shownLines`. Each block says where it starts in the text.
 */
export function parseMarkdown(text: string, call: { final: boolean }): Block[] {
  const { lines, starts } = splitLines(text);
  if (call.final) return readBlocks(lines, starts);
  return withoutDanglingRow(readBlocks(shownLines(lines), starts));
}

function readBlocks(lines: string[], starts: number[]): Block[] {
  const blocks: Block[] = [];
  for (let at = 0; at < lines.length; ) {
    if ((lines[at] ?? "").trim() === "") {
      at++;
      continue;
    }
    const { block, next } = readBlock(lines, at);
    blocks.push({ ...block, offset: starts[at] ?? 0 });
    at = next;
  }
  return blocks;
}
