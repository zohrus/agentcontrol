import type { AgentUpdate } from "@agentcontrol/protocol";
import { z } from "zod";
import { toolStarted, toolUpdated } from "./tools.ts";

/** Reads one kind of `session/update`; undefined means the update was not shaped as expected. */
type Handler = (update: unknown) => AgentUpdate[] | undefined;

const TextChunk = z.looseObject({
  content: z.looseObject({ type: z.literal("text"), text: z.string() }),
  messageId: z.string().nullish().catch(undefined),
});

function textChunk(type: "user-text" | "agent-text" | "agent-thought"): Handler {
  return (update) => {
    const chunk = TextChunk.safeParse(update);
    if (!chunk.success) return undefined;
    const { content, messageId } = chunk.data;
    return [{ type, text: content.text, messageId: messageId ?? undefined }];
  };
}

const Plan = z.looseObject({
  entries: z.array(z.looseObject({ content: z.string(), status: z.string().catch("pending") })),
});

const PLAN_STATUSES = ["pending", "in_progress", "completed"] as const;

const plan: Handler = (update) => {
  const parsed = Plan.safeParse(update);
  if (!parsed.success) return undefined;
  const entries = parsed.data.entries.map(({ content, status }) => ({
    content,
    status: PLAN_STATUSES.find((known) => known === status) ?? "pending",
  }));
  return [{ type: "plan", entries }];
};

const Mode = z.looseObject({ currentModeId: z.string() });

const modeChanged: Handler = (update) => {
  const parsed = Mode.safeParse(update);
  return parsed.success ? [{ type: "mode-changed", modeId: parsed.data.currentModeId }] : undefined;
};

const Notice = z.looseObject({
  severity: z.enum(["info", "warning", "error"]).catch("info"),
  title: z.string(),
  description: z.string().nullish().catch(undefined),
});

const notice: Handler = (update) => {
  const parsed = Notice.safeParse(update);
  if (!parsed.success) return undefined;
  const { severity, title, description } = parsed.data;
  return [{ type: "notice", severity, text: description ? `${title}: ${description}` : title }];
};

/** Codex reports a failing connection as `_meta.codex.error` on a `session_info_update`. */
const CodexError = z.looseObject({
  _meta: z.looseObject({
    codex: z.looseObject({
      error: z.looseObject({
        message: z.string(),
        additionalDetails: z.string().nullish().catch(undefined),
        willRetry: z.boolean().catch(false),
      }),
    }),
  }),
});

const sessionInfo: Handler = (update) => {
  const parsed = CodexError.safeParse(update);
  if (!parsed.success) return undefined;
  const { message, additionalDetails, willRetry } = parsed.data._meta.codex.error;
  const text = additionalDetails ? `${message} (${additionalDetails})` : message;
  return [{ type: "notice", severity: willRetry ? "warning" : "error", text }];
};

/** Claude names the model in `_meta["_claude/model"]` of its usage updates. */
const Usage = z.looseObject({
  used: z.number().optional().catch(undefined),
  size: z.number().optional().catch(undefined),
  cost: z.looseObject({ amount: z.number(), currency: z.string() }).nullish().catch(undefined),
  _meta: z
    .looseObject({ "_claude/model": z.string().optional().catch(undefined) })
    .nullish()
    .catch(undefined),
});

const usage: Handler = (update) => {
  const parsed = Usage.safeParse(update);
  if (!parsed.success) return undefined;
  const { used, size, cost, _meta } = parsed.data;
  const costUsd = cost?.currency === "USD" ? cost.amount : undefined;
  return [
    {
      type: "usage",
      contextUsed: used,
      contextSize: size,
      costUsd,
      model: _meta?.["_claude/model"],
    },
  ];
};

/** One small reader per ACP `sessionUpdate` kind that we interpret. Any other kind becomes "other". */
export const sessionUpdateHandlers = new Map<string, Handler>([
  ["user_message_chunk", textChunk("user-text")],
  ["agent_message_chunk", textChunk("agent-text")],
  ["agent_thought_chunk", textChunk("agent-thought")],
  ["plan", plan],
  ["tool_call", toolStarted],
  ["tool_call_update", toolUpdated],
  ["current_mode_update", modeChanged],
  ["notice", notice],
  ["session_info_update", sessionInfo],
  ["usage_update", usage],
]);
