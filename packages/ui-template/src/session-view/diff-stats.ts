import type { FileChange } from "@agentcontrol/protocol";
import type { DiffStat } from "./view-items.ts";

function toLines(text: string | undefined): string[] {
  return text ? text.split("\n") : [];
}

function tally(lines: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of lines) counts.set(line, (counts.get(line) ?? 0) + 1);
  return counts;
}

function take(available: Map<string, number>, line: string): boolean {
  const left = available.get(line) ?? 0;
  if (left > 0) available.set(line, left - 1);
  return left > 0;
}

function countUnmatched(lines: string[], other: string[]): number {
  const available = tally(other);
  return lines.filter((line) => !take(available, line)).length;
}

/** Added and removed line counts of one changed file: as sent, or by comparing the lines as multisets. */
function statOf(change: FileChange): DiffStat {
  if ("additions" in change) return { additions: change.additions, deletions: change.deletions };
  const before = toLines(change.oldText);
  const after = toLines(change.newText);
  return { additions: countUnmatched(after, before), deletions: countUnmatched(before, after) };
}

/** Summed stat of every changed file, or undefined when there is none. */
export function diffStatOf(files: readonly FileChange[] | undefined): DiffStat | undefined {
  if (files === undefined || files.length === 0) return undefined;
  return files.map(statOf).reduce((sum, s) => ({
    additions: sum.additions + s.additions,
    deletions: sum.deletions + s.deletions,
  }));
}
