export const FENCE = /^\s*```(\S*)\s*$/;
export const HEADING = /^(#{1,6})\s+(.*)$/;
export const BULLET = /^\s*(?:[-*]|\d+[.)])\s+(.*)$/;

/** The text's lines, and where each one starts in the text. */
export function splitLines(text: string): { lines: string[]; starts: number[] } {
  const lines = text.split("\n");
  const starts: number[] = [];
  let at = 0;
  for (const line of lines) {
    starts.push(at);
    at += line.length + 1;
  }
  return { lines, starts };
}

/** Whether a code fence is still open after these lines. */
export function insideFence(lines: readonly string[]): boolean {
  let open = false;
  for (const line of lines) {
    open = open ? line.trim() !== "```" : FENCE.test(line);
  }
  return open;
}
