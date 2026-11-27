import { formatCost, formatTokens } from "./format.ts";

/** Token counts for a session, and its cost and model when the agent reports them. */
export type SessionUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd?: number | undefined;
  model?: string | undefined;
};

/** "1.2k in · 340 out · 800 cache read · 50 cache write". */
export function usageBreakdown(usage: SessionUsage): string {
  return [
    `${formatTokens(usage.inputTokens)} in`,
    `${formatTokens(usage.outputTokens)} out`,
    `${formatTokens(usage.cacheReadTokens)} cache read`,
    `${formatTokens(usage.cacheWriteTokens)} cache write`,
  ].join(" · ");
}

/** "1.5k tokens · $0.02"; the tokens alone when the agent reports no cost. */
export function usageHeadline(usage: SessionUsage): string {
  const tokens = `${formatTokens(usage.inputTokens + usage.outputTokens)} tokens`;
  return usage.costUsd === undefined ? tokens : `${tokens} · ${formatCost(usage.costUsd)}`;
}

/** The cost alone ("$1.84"), or the tokens when the agent reports no cost. */
export function usageCostOrTokens(usage: SessionUsage): string {
  return usage.costUsd === undefined ? usageHeadline(usage) : formatCost(usage.costUsd);
}
