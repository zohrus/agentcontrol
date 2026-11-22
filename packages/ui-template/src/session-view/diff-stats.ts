import { z } from "zod";
import type { DiffStat } from "./view-items.ts";

const DiffContent = z.object({
  type: z.literal("diff"),
  path: z.string(),
  oldText: z.string().nullish(),
  newText: z.string(),
});
type DiffContent = z.infer<typeof DiffContent>;

function toLines(text: string | null | undefined): string[] {
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

/** Added and removed line counts of one ACP diff, by comparing the lines as multisets. */
function statOf(diff: DiffContent): DiffStat {
  const before = toLines(diff.oldText);
  const after = toLines(diff.newText);
  return { additions: countUnmatched(after, before), deletions: countUnmatched(before, after) };
}

/** The diffs found in an ACP tool call content list; other content is ignored. */
export function diffsIn(content: readonly unknown[] | null | undefined): DiffContent[] {
  const found: DiffContent[] = [];
  for (const item of content ?? []) {
    const parsed = DiffContent.safeParse(item);
    if (parsed.success) found.push(parsed.data);
  }
  return found;
}

/** Summed stat of every diff in the content, or undefined when there is none. */
export function diffStatOf(content: readonly unknown[] | null | undefined): DiffStat | undefined {
  const diffs = diffsIn(content);
  if (diffs.length === 0) return undefined;
  return diffs.map(statOf).reduce((sum, s) => ({
    additions: sum.additions + s.additions,
    deletions: sum.deletions + s.deletions,
  }));
}
