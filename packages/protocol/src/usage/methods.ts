import { z } from "zod";
import { SessionId } from "../ids/index.ts";

const count = z.number().int().nonnegative();

/** One turn's token usage (and the cost billed since the previous row) for one session. */
export const UsageRow = z.object({
  sessionId: z.string(),
  ts: z.string(),
  model: z.string().optional(),
  inputTokens: count,
  outputTokens: count,
  cacheReadTokens: count,
  cacheWriteTokens: count,
  costUsd: z.number().optional(),
  source: z.literal("acp"),
});
export type UsageRow = z.infer<typeof UsageRow>;

/** Params of relay/usage: one session, or every session when left out. */
export const UsageParams = z.object({ sessionId: SessionId.optional() });
/** Result of relay/usage: one row per finished turn, oldest first within each session. */
export const UsageResult = z.object({ rows: z.array(UsageRow) });

export type UsageParams = z.infer<typeof UsageParams>;
export type UsageResult = z.infer<typeof UsageResult>;
