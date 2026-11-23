import type { AgentUpdate } from "@agentcontrol/protocol";
import { z } from "zod";
import { sessionUpdateHandlers } from "./session-updates.ts";

const Envelope = z.looseObject({
  method: z.string().optional().catch(undefined),
  params: z.unknown().optional(),
  result: z.unknown().optional(),
});

const UpdateParams = z.looseObject({
  update: z.looseObject({ sessionUpdate: z.string() }),
});

const PromptParams = z.looseObject({
  prompt: z.array(
    z.looseObject({ type: z.string(), text: z.string().optional().catch(undefined) }),
  ),
});

const tokens = z.number().catch(0);

/** What Claude lists per model in `_meta.quota`; the cache is counted apart from the input. */
const ModelUsage = z.looseObject({
  model: z.string(),
  token_count: z.looseObject({
    totalTokens: tokens,
    inputTokens: tokens,
    outputTokens: tokens,
    cachedInputTokens: tokens,
    cachedWriteTokens: tokens,
  }),
});

/** The result of `session/prompt`; Claude lists the models of the turn in `_meta.quota`. */
const PromptResult = z.looseObject({
  stopReason: z.string(),
  usage: z
    .looseObject({
      inputTokens: tokens,
      outputTokens: tokens,
      cachedReadTokens: tokens,
      cachedWriteTokens: tokens,
    })
    .nullish()
    .catch(undefined),
  _meta: z
    .looseObject({ quota: z.looseObject({ model_usage: z.array(ModelUsage) }) })
    .nullish()
    .catch(undefined),
});

type Meta = z.infer<typeof PromptResult>["_meta"];

/** The model that used the most tokens in the turn, when the adapter says. */
function mainModelUsage(meta: Meta): z.infer<typeof ModelUsage> | undefined {
  const models = meta?.quota.model_usage ?? [];
  return models.toSorted((a, b) => b.token_count.totalTokens - a.token_count.totalTokens)[0];
}

type TurnTokens = Omit<Extract<AgentUpdate, { type: "turn-usage" }>, "type" | "model">;

const isEmpty = (spent: TurnTokens): boolean => Object.values(spent).every((count) => count === 0);

/** What every model of the turn used, from `_meta.quota`; the adapter counts the cache apart from the input. */
function quotaTokens(meta: Meta): TurnTokens | undefined {
  const entries = (meta?.quota.model_usage ?? []).map((entry) => entry.token_count);
  if (entries.length === 0) return undefined;
  const sum = (count: (usage: (typeof entries)[number]) => number): number =>
    entries.reduce((total, usage) => total + count(usage), 0);
  return {
    inputTokens: sum((usage) => usage.inputTokens),
    outputTokens: sum((usage) => usage.outputTokens),
    cacheReadTokens: sum((usage) => usage.cachedInputTokens),
    cacheWriteTokens: sum((usage) => usage.cachedWriteTokens),
  };
}

/**
 * The tokens of the turn. A cancelled Claude turn reports `usage` as all zeros although it spent
 * tokens; its `_meta.quota` (per turn, not cumulative) still has them, so that is the fallback when
 * `usage` is empty.
 */
function tokensOfTurn(parsed: {
  usage: NonNullable<z.infer<typeof PromptResult>["usage"]>;
  meta: Meta;
}): TurnTokens {
  const { usage, meta } = parsed;
  const reported = {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cachedReadTokens,
    cacheWriteTokens: usage.cachedWriteTokens,
  };
  return isEmpty(reported) ? (quotaTokens(meta) ?? reported) : reported;
}

function sessionUpdate(params: unknown): AgentUpdate[] {
  const parsed = UpdateParams.safeParse(params);
  if (!parsed.success) return [{ type: "other", name: "session/update" }];
  const { update } = parsed.data;
  const read = sessionUpdateHandlers.get(update.sessionUpdate);
  return read?.(update) ?? [{ type: "other", name: update.sessionUpdate }];
}

function promptResult(result: unknown): AgentUpdate[] {
  const parsed = PromptResult.safeParse(result);
  if (!parsed.success) return [];
  const { stopReason, usage, _meta } = parsed.data;
  const ended: AgentUpdate = { type: "turn-ended", stopReason };
  if (!usage) return [ended];
  const model = mainModelUsage(_meta)?.model;
  return [ended, { type: "turn-usage", model, ...tokensOfTurn({ usage, meta: _meta }) }];
}

function promptText(params: unknown): AgentUpdate[] {
  const parsed = PromptParams.safeParse(params);
  if (!parsed.success) return [];
  const blocks = parsed.data.prompt.filter((block) => block.type === "text");
  return blocks.flatMap(({ text }) => (text === undefined ? [] : [{ type: "user-text", text }]));
}

function fromAgent(message: z.infer<typeof Envelope>): AgentUpdate[] {
  const { method } = message;
  if (method === "session/update") return sessionUpdate(message.params);
  // The permission request is described by the "permission-requested" event.
  if (method === "session/request_permission") return [];
  if (method !== undefined) return [{ type: "other", name: method }];
  return promptResult(message.result);
}

/** Every message in the protocol, routed by who sent it and what it is. */
export function normaliseMessage(input: {
  direction: "to-agent" | "from-agent";
  message: unknown;
}): AgentUpdate[] {
  const envelope = Envelope.safeParse(input.message);
  if (!envelope.success) return [];
  if (input.direction === "from-agent") return fromAgent(envelope.data);
  return envelope.data.method === "session/prompt" ? promptText(envelope.data.params) : [];
}
