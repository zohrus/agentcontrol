import type { FileChange } from "@agentcontrol/protocol";

function linesOf(text: string | undefined): string[] {
  if (text === undefined || text === "") return [];
  const lines = text.split("\n");
  return lines.at(-1) === "" ? lines.slice(0, -1) : lines;
}

/** For each distinct line, how many more times it is in `after` than in `before` (negative: fewer). */
function surplus(call: { before: string[]; after: string[] }): number[] {
  const difference = new Map<string, number>();
  for (const line of call.after) difference.set(line, (difference.get(line) ?? 0) + 1);
  for (const line of call.before) difference.set(line, (difference.get(line) ?? 0) - 1);
  return [...difference.values()];
}

const total = (numbers: number[]): number => numbers.reduce((sum, n) => sum + n, 0);

/**
 * Lines added and removed by one change. With the text before and after, the lines are compared as
 * a bag of lines (moving a line is no change; no diff algorithm needed); with only counts, those.
 */
export function lineCountsOf(change: FileChange): { added: number; removed: number } {
  if ("additions" in change) return { added: change.additions, removed: change.deletions };
  const differences = surplus({ before: linesOf(change.oldText), after: linesOf(change.newText) });
  return {
    added: total(differences.filter((n) => n > 0)),
    removed: -total(differences.filter((n) => n < 0)),
  };
}
