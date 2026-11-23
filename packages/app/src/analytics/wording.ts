/** 125_000 ms as "2m", 45_000 as "45s", 4_000_000 as "1h 07m". */
export function duration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${String(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${String(minutes)}m`;
  return `${String(Math.floor(minutes / 60))}h ${String(minutes % 60).padStart(2, "0")}m`;
}

/** Dollars with enough decimals to show a small amount: "$12.40", "$0.043". */
export function dollars(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  return usd >= 0.01 ? `$${usd.toFixed(3)}` : `$${usd.toFixed(4)}`;
}

/** "1 session", "3 sessions". */
export const count = (n: number, noun: string): string =>
  `${String(n)} ${noun}${n === 1 ? "" : "s"}`;

/** A title in quotes, shortened when long. */
export function quoted(title: string): string {
  return `"${title.length > 40 ? `${title.slice(0, 39)}…` : title}"`;
}

/** 0.234 as "23%". */
export const percent = (share: number): string => `${String(Math.round(share * 100))}%`;
