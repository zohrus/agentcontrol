import type { UsageRow } from "@agentcontrol/protocol";
import type { TokenCounts } from "./types.ts";

const noTokens = (): TokenCounts => ({
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  total: 0,
});

/** The tokens of one turn, as counts. */
export function tokensOfRow(row: UsageRow): TokenCounts {
  const { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens } = row;
  return {
    input: inputTokens,
    output: outputTokens,
    cacheRead: cacheReadTokens,
    cacheWrite: cacheWriteTokens,
    total: inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens,
  };
}

/** Sums token counts. */
export function addTokens(counts: TokenCounts[]): TokenCounts {
  return counts.reduce(
    (sum, next) => ({
      input: sum.input + next.input,
      output: sum.output + next.output,
      cacheRead: sum.cacheRead + next.cacheRead,
      cacheWrite: sum.cacheWrite + next.cacheWrite,
      total: sum.total + next.total,
    }),
    noTokens(),
  );
}

/** A row that used tokens; the cost-only row the relay adds for cost billed after the last turn does not. */
export const usedTokens = (row: UsageRow): boolean => tokensOfRow(row).total > 0;

/** The cost the agent reported across these rows, or nothing when it reported none. */
export function reportedCost(rows: UsageRow[]): number | undefined {
  const costs = rows.flatMap((row) => (row.costUsd === undefined ? [] : [row.costUsd]));
  return costs.length === 0 ? undefined : costs.reduce((sum, cost) => sum + cost, 0);
}
