export interface UsageRow {
  sessionId: string;
  ts: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd?: number;
  source: "acp" | "claude-log" | "codex-log";
}

export interface UsageTotal {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd?: number;
  turns: number;
}
