import type { PendingPermissionRequest, PendingToolCall } from "@agentcontrol/protocol";
import { z } from "zod";

/** The parts of an agent's tool call that are the same across agents; the rest is ignored. */
const ToolCallShape = z.looseObject({
  title: z.string().optional(),
  kind: z.string().optional(),
  rawInput: z.looseObject({ command: z.string().optional() }).optional(),
  locations: z.array(z.looseObject({ path: z.string() })).optional(),
});
type ToolCallShape = z.infer<typeof ToolCallShape>;

const present = (text: string | undefined): string | undefined => text || undefined;

/** The optional fields of the summary: only the ones the agent gave. */
function details(call: ToolCallShape): Omit<PendingToolCall, "title"> {
  const entries = {
    kind: present(call.kind),
    command: present(call.rawInput?.command),
    path: present(call.locations?.[0]?.path),
  };
  return Object.fromEntries(Object.entries(entries).filter(([, value]) => value !== undefined));
}

/** A small agent-neutral view of a raw tool call; a call it cannot read still gets a title. */
function summarizeToolCall(raw: unknown): PendingToolCall {
  const parsed = ToolCallShape.safeParse(raw);
  const call = parsed.success ? parsed.data : {};
  const found = details(call);
  return {
    title: present(call.title) ?? found.command ?? found.kind ?? "Permission request",
    ...found,
  };
}

/** The pending-request entry for a `permission-requested` payload. */
export function pendingRequestOf(payload: {
  requestId: string;
  toolCall: unknown;
  options: PendingPermissionRequest["options"];
}): PendingPermissionRequest {
  return {
    requestId: payload.requestId,
    options: payload.options,
    toolCall: summarizeToolCall(payload.toolCall),
  };
}
