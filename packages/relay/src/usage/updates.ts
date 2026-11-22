import type { AgentUpdate, SessionEvent, UsageRow } from "@agentcontrol/protocol";
import { makeRow, NO_TOKENS, type Tokens } from "./row.ts";

interface State {
  model: string | undefined;
  cost: number;
  billed: number;
  rows: UsageRow[];
}

type TurnUsage = Extract<AgentUpdate, { type: "turn-usage" }>;

const tokensOf = (turn: TurnUsage): Tokens => ({
  inputTokens: turn.inputTokens,
  outputTokens: turn.outputTokens,
  cacheReadTokens: turn.cacheReadTokens,
  cacheWriteTokens: turn.cacheWriteTokens,
});

/**
 * Reads only the normalised `updates` of the events, so it knows nothing of any agent protocol.
 * A `usage` update does NOT carry per-turn tokens: it holds the tokens currently in the context
 * window (it shrinks on compaction) and the cumulative session cost. So rows are derived as deltas:
 * - tokens come from the `turn-usage` update of each finished turn (per turn, summable);
 * - cost is the growth of the cumulative cost since the previous row, attached to the row of the
 *   turn that ends next; cost still unbilled at the end of the log becomes a tokenless row;
 * - model is the one the turn names, else the latest one a `usage` update named.
 * The events must come from the relay with `updates` attached.
 */
export function usageFromEvents(events: SessionEvent[]): UsageRow[] {
  const state: State = { model: undefined, cost: 0, billed: 0, rows: [] };
  const incoming = events.filter((e) => e.kind === "acp" && e.payload.direction === "from-agent");
  for (const event of incoming) step({ state, event });
  const last = incoming.at(-1);
  if (last && state.cost > state.billed) pushRow({ state, event: last, tokens: NO_TOKENS });
  return state.rows;
}

function step(input: { state: State; event: SessionEvent }): void {
  const { state, event } = input;
  const updates = event.kind === "acp" ? (event.payload.updates ?? []) : [];
  for (const update of updates) apply({ state, event, update });
}

function apply(input: { state: State; event: SessionEvent; update: AgentUpdate }): void {
  const { state, event, update } = input;
  if (update.type === "usage") applyUsage(state, update);
  if (update.type !== "turn-usage") return;
  pushRow({ state, event, tokens: tokensOf(update), model: update.model });
}

function applyUsage(
  state: State,
  update: { model?: string | undefined; costUsd?: number | undefined },
) {
  state.model = update.model ?? state.model;
  state.cost = update.costUsd ?? state.cost;
}

function pushRow(input: {
  state: State;
  event: SessionEvent;
  tokens: Tokens;
  model?: string | undefined;
}): void {
  const { state, event, tokens } = input;
  const delta = state.cost - state.billed;
  state.billed = state.cost;
  state.rows.push(
    makeRow({
      sessionId: event.sessionId,
      ts: event.ts,
      model: input.model ?? state.model,
      source: "acp",
      tokens,
      costUsd: delta > 0 ? delta : undefined,
    }),
  );
}
