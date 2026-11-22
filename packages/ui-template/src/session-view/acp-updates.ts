import { z } from "zod";

const chunk = {
  content: z.object({ type: z.literal("text"), text: z.string() }),
  messageId: z.string().nullish(),
};

const toolFields = {
  toolCallId: z.string(),
  kind: z.string().nullish(),
  status: z.string().nullish(),
  content: z.array(z.unknown()).nullish(),
  locations: z.array(z.object({ path: z.string() })).nullish(),
};

/**
 * The ACP session/update kinds the default UI shows; every other kind is ignored.
 * usage_update is deliberately not shown in the stream (it feeds the header's usage chip) and
 * available_commands_update is ignored.
 */
export const AcpUpdate = z.discriminatedUnion("sessionUpdate", [
  z.object({ sessionUpdate: z.literal("user_message_chunk"), ...chunk }),
  z.object({ sessionUpdate: z.literal("agent_message_chunk"), ...chunk }),
  z.object({ sessionUpdate: z.literal("agent_thought_chunk"), ...chunk }),
  z.object({
    sessionUpdate: z.literal("plan"),
    entries: z.array(z.object({ content: z.string(), status: z.string() })),
  }),
  z.object({ sessionUpdate: z.literal("tool_call"), title: z.string(), ...toolFields }),
  z.object({
    sessionUpdate: z.literal("tool_call_update"),
    title: z.string().nullish(),
    ...toolFields,
  }),
  z.object({ sessionUpdate: z.literal("current_mode_update"), currentModeId: z.string() }),
  z.object({
    sessionUpdate: z.literal("notice"),
    severity: z.string().nullish(),
    title: z.string(),
    description: z.string().nullish(),
  }),
  z.object({
    sessionUpdate: z.literal("compaction_update"),
    compactionId: z.string(),
    status: z.string(),
  }),
]);
export type AcpUpdate = z.infer<typeof AcpUpdate>;

const UpdateNotification = z.object({
  method: z.literal("session/update"),
  params: z.object({ update: z.unknown() }),
});

/** Narrows a raw ACP message from the agent to a supported session update, if it is one. */
export function parseAcpUpdate(message: unknown): AcpUpdate | undefined {
  const notification = UpdateNotification.safeParse(message);
  if (!notification.success) return undefined;
  const update = AcpUpdate.safeParse(notification.data.params.update);
  return update.success ? update.data : undefined;
}
