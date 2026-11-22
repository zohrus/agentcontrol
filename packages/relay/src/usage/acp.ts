import type { SessionEvent } from "@agentcontrol/protocol";
import { z } from "zod";
import { makeRow, NO_TOKENS, type Tokens } from "./row.ts";
import type { UsageRow } from "./types.ts";

const num = z.number().catch(0);

const UpdateMessage = z
  .looseObject({
    method: z.literal("session/update"),
    params: z.looseObject({
      update: z.looseObject({
        sessionUpdate: z.literal("usage_update"),
        cost: z
          .looseObject({ amount: z.number(), currency: z.string() })
          .nullish()
          .catch(undefined),
        _meta: z
          .looseObject({ "_claude/model": z.string().optional().catch(undefined) })
          .nullish()
          .catch(undefined),
      }),
    }),
  })
  .transform(({ params: { update } }) => ({
    kind: "update" as const,
    model: update._meta?.["_claude/model"],
    cost: update.cost?.currency === "USD" ? update.cost.amount : undefined,
  }));

const TurnResult = z
  .looseObject({
    result: z.looseObject({
      usage: z.looseObject({
        inputTokens: num,
        outputTokens: num,
        cachedReadTokens: num,
        cachedWriteTokens: num,
      }),
    }),
  })
  .transform(({ result: { usage } }) => ({
    kind: "turn" as const,
    tokens: {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cachedReadTokens,
      cacheWriteTokens: usage.cachedWriteTokens,
    },
  }));

const Message = z.union([UpdateMessage, TurnResult]);

interface State {
  model: string | undefined;
  cost: number;
  billed: number;
  rows: UsageRow[];
}

/**
 * ACP `usage_update` does NOT carry per-turn tokens: `used` is the tokens currently in the context
 * window (it shrinks on compaction) and `size` the window size. Only `cost.amount` is billing data,
 * and the SDK documents it as the cumulative session cost. So rows are derived as deltas:
 * - tokens come from the `usage` of each `session/prompt` result (per turn, summable);
 * - cost is the growth of `cost.amount` (USD only) since the previous row, attached to the row of
 *   the turn that ends next; cost still unbilled at the end of the log becomes a tokenless row;
 * - model is the latest `_meta["_claude/model"]` seen on a usage_update.
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
  const message = event.kind === "acp" ? event.payload.message : undefined;
  const parsed = Message.safeParse(message);
  if (!parsed.success) return;
  if (parsed.data.kind === "turn") pushRow({ state, event, tokens: parsed.data.tokens });
  else applyUpdate(state, parsed.data);
}

function applyUpdate(
  state: State,
  update: { model?: string | undefined; cost?: number | undefined },
) {
  state.model = update.model ?? state.model;
  state.cost = update.cost ?? state.cost;
}

function pushRow(input: { state: State; event: SessionEvent; tokens: Tokens }): void {
  const { state, event, tokens } = input;
  const delta = state.cost - state.billed;
  state.billed = state.cost;
  state.rows.push(
    makeRow({
      sessionId: event.sessionId,
      ts: event.ts,
      model: state.model,
      source: "acp",
      tokens,
      costUsd: delta > 0 ? delta : undefined,
    }),
  );
}
