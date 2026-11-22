import type { UsageRow, UsageTotal } from "./types.ts";

/** Sums rows per model (rows without a model go under "unknown"); `costUsd` only if some row has it. */
export function totalUsage(rows: UsageRow[]): UsageTotal[] {
  const byModel = new Map<string, UsageTotal>();
  for (const row of rows) {
    const key = row.model ?? "unknown";
    byModel.set(key, add(byModel.get(key) ?? empty(key), row));
  }
  return [...byModel.values()];
}

function empty(model: string): UsageTotal {
  return {
    model,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    turns: 0,
  };
}

function add(total: UsageTotal, row: UsageRow): UsageTotal {
  const costUsd = row.costUsd === undefined ? total.costUsd : (total.costUsd ?? 0) + row.costUsd;
  return {
    ...total,
    inputTokens: total.inputTokens + row.inputTokens,
    outputTokens: total.outputTokens + row.outputTokens,
    cacheReadTokens: total.cacheReadTokens + row.cacheReadTokens,
    cacheWriteTokens: total.cacheWriteTokens + row.cacheWriteTokens,
    turns: total.turns + 1,
    ...(costUsd === undefined ? {} : { costUsd }),
  };
}
