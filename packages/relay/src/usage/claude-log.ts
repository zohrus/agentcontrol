import { z } from "zod";
import { readJsonl } from "./jsonl.ts";
import { makeRow } from "./row.ts";
import type { UsageRow } from "./types.ts";

const num = z.number().catch(0);
const text = z.string().optional().catch(undefined);

const Line = z.looseObject({
  type: z.literal("assistant"),
  timestamp: z.string(),
  requestId: text,
  message: z.looseObject({
    id: text,
    model: text,
    usage: z.looseObject({
      input_tokens: num,
      output_tokens: num,
      cache_read_input_tokens: num,
      cache_creation_input_tokens: num,
    }),
  }),
});
type Line = z.infer<typeof Line>;

/**
 * Claude Code writes one line per content block of a streamed API response, each repeating the
 * response's `usage`. Lines are therefore deduplicated by `message.id` + `requestId` (the last
 * one wins, it has the final output count). Claude logs carry no cost, so `costUsd` stays unset.
 */
export async function usageFromClaudeLog(options: {
  path: string;
  sessionId: string;
}): Promise<UsageRow[]> {
  const lines = await readJsonl(options.path, Line);
  const byResponse = new Map<string, Line>();
  lines.forEach((line, index) => {
    byResponse.set(responseKey(line, index), line);
  });
  return [...byResponse.values()]
    .filter((line) => line.message.model !== "<synthetic>")
    .map((line) => toRow(line, options.sessionId));
}

function responseKey(line: Line, index: number): string {
  const id = line.message.id;
  return id === undefined ? `line-${String(index)}` : `${id}:${line.requestId ?? ""}`;
}

function toRow(line: Line, sessionId: string): UsageRow {
  const usage = line.message.usage;
  return makeRow({
    sessionId,
    ts: line.timestamp,
    model: line.message.model,
    source: "claude-log",
    tokens: {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens: usage.cache_read_input_tokens,
      cacheWriteTokens: usage.cache_creation_input_tokens,
    },
  });
}
