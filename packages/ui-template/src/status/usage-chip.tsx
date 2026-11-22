import { formatCost, formatTokens } from "./format.ts";

/** Token counts for a session, and its cost when the agent reports one. */
export type SessionUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd?: number | undefined;
};

function breakdown(usage: SessionUsage): string {
  const parts = [
    `${formatTokens(usage.inputTokens)} input`,
    `${formatTokens(usage.outputTokens)} output`,
    `${formatTokens(usage.cacheReadTokens)} cache read`,
    `${formatTokens(usage.cacheWriteTokens)} cache write`,
  ];
  return parts.join(", ");
}

/** A small chip with the session's tokens and cost; shows tokens only when cost is unknown. */
export function UsageChip({ usage }: { usage: SessionUsage }) {
  const tokens = `${formatTokens(usage.inputTokens + usage.outputTokens)} tokens`;
  const text = usage.costUsd === undefined ? tokens : `${tokens} · ${formatCost(usage.costUsd)}`;
  return (
    <span
      data-testid="usage-chip"
      title={breakdown(usage)}
      className="rounded-full bg-code px-2 py-px font-mono text-[11px] text-muted"
    >
      {text}
    </span>
  );
}
