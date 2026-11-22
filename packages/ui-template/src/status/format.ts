/** 1234 becomes "1.2k", 2_500_000 becomes "2.5M"; small numbers stay as they are. */
export function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

/** 0.4213 becomes "$0.42". */
export function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
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
