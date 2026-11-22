import { z } from "zod";
import { readJsonl } from "./jsonl.ts";
import { makeRow, type Tokens } from "./row.ts";
import type { UsageRow } from "./types.ts";

const num = z.number().catch(0);
const Counts = z.looseObject({
  input_tokens: num,
  cached_input_tokens: num,
  output_tokens: num,
  total_tokens: z.number().optional().catch(undefined),
});

const TurnContext = z.looseObject({
  type: z.literal("turn_context"),
  payload: z.looseObject({ model: z.string().optional().catch(undefined) }),
});
const TokenCount = z
  .looseObject({
    type: z.literal("event_msg"),
    timestamp: z.string(),
    payload: z.looseObject({
      type: z.literal("token_count"),
      info: z
        .looseObject({ last_token_usage: Counts.nullish(), total_token_usage: Counts.nullish() })
        .nullish(),
    }),
  })
  .transform((line) => ({
    type: "token_count" as const,
    timestamp: line.timestamp,
    last: line.payload.info?.last_token_usage ?? undefined,
    total: line.payload.info?.total_token_usage?.total_tokens,
  }));
const Line = z.union([TurnContext, TokenCount]);
type Line = z.infer<typeof Line>;
type TokenCountLine = z.infer<typeof TokenCount>;

interface State {
  model: string | undefined;
  lastTotal: number | undefined;
  rows: UsageRow[];
}

/**
 * Codex logs `token_count` events with `last_token_usage` (this turn) and `total_token_usage`
 * (cumulative). The last-turn counts are used; an event whose cumulative total did not change is a
 * repeat and is skipped. Codex `input_tokens` includes the cached ones, so cache reads are
 * subtracted from input. `output_tokens` already includes reasoning. The model is the latest
 * `turn_context` before the event. Codex logs carry no cost.
 */
export async function usageFromCodexLog(options: {
  path: string;
  sessionId: string;
}): Promise<UsageRow[]> {
  const state: State = { model: undefined, lastTotal: undefined, rows: [] };
  for (const line of await readJsonl(options.path, Line)) {
    step({ state, line, sessionId: options.sessionId });
  }
  return state.rows;
}

function step(input: { state: State; line: Line; sessionId: string }): void {
  const { state, line, sessionId } = input;
  if (line.type === "turn_context") state.model = line.payload.model;
  else addRow({ state, line, sessionId });
}

function addRow(input: { state: State; line: TokenCountLine; sessionId: string }): void {
  const { state, line, sessionId } = input;
  if (!line.last || isRepeat(line.total, state.lastTotal)) return;
  state.lastTotal = line.total;
  state.rows.push(
    makeRow({
      sessionId,
      ts: line.timestamp,
      model: state.model,
      source: "codex-log",
      tokens: toTokens(line.last),
    }),
  );
}

function isRepeat(total: number | undefined, lastTotal: number | undefined): boolean {
  return total !== undefined && total === lastTotal;
}

function toTokens(counts: z.infer<typeof Counts>): Tokens {
  return {
    inputTokens: Math.max(0, counts.input_tokens - counts.cached_input_tokens),
    outputTokens: counts.output_tokens,
    cacheReadTokens: counts.cached_input_tokens,
    cacheWriteTokens: 0,
  };
}
