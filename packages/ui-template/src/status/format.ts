/** "1 file", "2 files": the noun with an "s" unless there is exactly one. */
export const countOf = (count: number, noun: string): string =>
  `${String(count)} ${noun}${count === 1 ? "" : "s"}`;

/** 1234 becomes "1.2k", 2_500_000 becomes "2.5M"; small numbers stay as they are. */
export function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

/** 0.4213 becomes "$0.42"; an amount under a cent shows as "<$0.01", never as "$0.00". */
export function formatCost(usd: number): string {
  return usd > 0 && usd < 0.01 ? "<$0.01" : `$${usd.toFixed(2)}`;
}

/** Like `formatCost`, but a sub-cent amount shows its digits: 0.0042 becomes "$0.0042". */
export function formatCostExact(usd: number): string {
  return usd > 0 && usd < 0.01 ? `$${usd.toFixed(4)}` : formatCost(usd);
}

/** Milliseconds as "45s", "12m", "3h 05m" or "2d 4h". */
export function formatElapsed(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 1) return `${String(Math.floor(Math.max(0, ms) / 1000))}s`;
  if (minutes < 60) return `${String(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)}h ${String(minutes % 60).padStart(2, "0")}m`;
  return `${String(Math.floor(hours / 24))}d ${String(hours % 24)}h`;
}
