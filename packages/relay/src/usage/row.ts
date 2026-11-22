import type { UsageRow } from "@agentcontrol/protocol";

export interface Tokens {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export const NO_TOKENS: Tokens = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

/** Builds a row, leaving `model` and `costUsd` out when unknown (exactOptionalPropertyTypes). */
export function makeRow(input: {
  sessionId: string;
  ts: string;
  source: UsageRow["source"];
  tokens: Tokens;
  model: string | undefined;
  costUsd?: number | undefined;
}): UsageRow {
  const { model, costUsd, tokens, ...rest } = input;
  return {
    ...rest,
    ...tokens,
    ...(model === undefined ? {} : { model }),
    ...(costUsd === undefined ? {} : { costUsd }),
  };
}
