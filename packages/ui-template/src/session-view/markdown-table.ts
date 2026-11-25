import type { Read } from "./markdown-types.ts";

const DELIMITER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

/** A line of a table: it starts with a pipe. */
export const isRow = (line: string): boolean => line.trimStart().startsWith("|");

const isDelimiter = (line: string): boolean => line.includes("|") && DELIMITER.test(line);

/** A header row with its delimiter row below it: only then is it a table, and not text with pipes. */
export const startsTable = (lines: string[], at: number): boolean =>
  isRow(lines[at] ?? "") && isDelimiter(lines[at + 1] ?? "");

function cellsOf(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/** A table: the header, the delimiter row, then every row that follows. */
export const table: Read = (lines, at) => {
  if (!startsTable(lines, at)) return undefined;
  const stop = lines.findIndex((line, index) => index > at + 1 && !isRow(line));
  const end = stop === -1 ? lines.length : stop;
  const rows = lines.slice(at + 2, end).map(cellsOf);
  return { block: { type: "table", header: cellsOf(lines[at] ?? ""), rows }, next: end };
};
