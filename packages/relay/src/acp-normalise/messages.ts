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
    .looseObject({
      quota: z.looseObject({
        model_usage: z.array(
          z.looseObject({ model: z.string(), token_count: z.looseObject({ totalTokens: tokens }) }),
        ),
      }),
    })
    .nullish()
    .catch(undefined),
});

/** The model that used the most tokens in the turn, when the adapter says. */
function mainModel(meta: z.infer<typeof PromptResult>["_meta"]): string | undefined {
  const models = meta?.quota.model_usage ?? [];
  const sorted = models.toSorted((a, b) => b.token_count.totalTokens - a.token_count.totalTokens);
  return sorted[0]?.model;
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
  const model = mainModel(_meta);
  const { inputTokens, outputTokens, cachedReadTokens, cachedWriteTokens } = usage;
  const spent = { inputTokens, outputTokens, cacheReadTokens: cachedReadTokens };
  return [ended, { type: "turn-usage", model, cacheWriteTokens: cachedWriteTokens, ...spent }];
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
