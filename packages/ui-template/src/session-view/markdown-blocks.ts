/** The few kinds of block the agents' replies use. Anything else is a paragraph. */
export type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "code"; lang: string; text: string }
  | { type: "list"; items: string[] }
  | { type: "paragraph"; text: string };

type Read = (lines: string[], at: number) => { block: Block; next: number } | undefined;

const FENCE = /^\s*```(\S*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*(?:[-*]|\d+[.)])\s+(.*)$/;

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

const startsOtherBlock = (line: string): boolean =>
  line.trim() === "" || FENCE.test(line) || HEADING.test(line) || BULLET.test(line);

/** Consecutive lines up to the next blank line or block, line breaks kept. */
const paragraph: Read = (lines, at) => {
  let end = at + 1;
  while (end < lines.length && !startsOtherBlock(lines[end] ?? "")) end++;
  return { block: { type: "paragraph", text: lines.slice(at, end).join("\n") }, next: end };
};

const readers: Read[] = [fence, heading, list, paragraph];

function readBlock(lines: string[], at: number): { block: Block; next: number } {
  for (const read of readers) {
    const found = read(lines, at);
    if (found) return found;
  }
  return { block: { type: "paragraph", text: lines[at] ?? "" }, next: at + 1 };
}

/** Splits an agent's reply into blocks; an unclosed code fence runs to the end, as while it streams. */
export function parseMarkdown(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let at = 0;
  while (at < lines.length) {
    if ((lines[at] ?? "").trim() === "") {
      at++;
      continue;
    }
    const { block, next } = readBlock(lines, at);
    blocks.push(block);
    at = next;
  }
  return blocks;
}

/** A piece of a line: plain text, `code` or **bold**. */
export type Span = { type: "text" | "code" | "bold"; text: string };

const INLINE = /(`[^`\n]+`|\*\*[^*\n]+\*\*)/;

function spanOf(part: string): Span {
  if (part.startsWith("`")) return { type: "code", text: part.slice(1, -1) };
  if (part.startsWith("**")) return { type: "bold", text: part.slice(2, -2) };
  return { type: "text", text: part };
}

export function parseInline(text: string): Span[] {
  return text
    .split(INLINE)
    .filter((part) => part !== "")
    .map(spanOf);
}
