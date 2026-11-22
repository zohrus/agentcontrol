import type { AgentUpdate, FileChange, ToolDescription } from "@agentcontrol/protocol";
import { z } from "zod";

const DiffContent = z.looseObject({
  type: z.literal("diff"),
  path: z.string(),
  oldText: z.string().nullish(),
  newText: z.string(),
});

/** An ACP tool call or tool call update; every field but the id may be missing or odd. */
const ToolCallShape = z.looseObject({
  toolCallId: z.string(),
  title: z.string().optional().catch(undefined),
  kind: z.string().optional().catch(undefined),
  status: z.string().optional().catch(undefined),
  content: z.array(z.unknown()).optional().catch(undefined),
  locations: z
    .array(z.looseObject({ path: z.string() }))
    .optional()
    .catch(undefined),
  rawInput: z.unknown().optional(),
});

const CommandInput = z.looseObject({ command: z.union([z.string(), z.array(z.string())]) });

const KINDS = new Map<string, ToolDescription["kind"]>([
  ["read", "read"],
  ["search", "search"],
  ["edit", "edit"],
  ["delete", "edit"],
  ["move", "edit"],
  ["execute", "execute"],
  ["fetch", "fetch"],
  ["think", "think"],
]);

const STATUSES = new Map<string, ToolDescription["status"]>([
  ["pending", "pending"],
  ["in_progress", "running"],
  ["completed", "completed"],
  ["failed", "failed"],
]);

function filesOf(content: unknown[] | undefined): FileChange[] | undefined {
  const diffs = (content ?? []).flatMap((item) => {
    const diff = DiffContent.safeParse(item);
    if (!diff.success) return [];
    const { path, oldText, newText } = diff.data;
    return [
      oldText === null || oldText === undefined ? { path, newText } : { path, oldText, newText },
    ];
  });
  return diffs.length > 0 ? diffs : undefined;
}

/** A patch holds only the fields the agent sent, so merging it never erases a known value. */
function withoutUndefined<T extends object>(fields: T): T {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as T;
}

function pathsOf(call: z.infer<typeof ToolCallShape>): string[] | undefined {
  const paths = (call.locations ?? []).map((location) => location.path);
  return paths.length > 0 ? paths : filesOf(call.content)?.map((file) => file.path);
}

function patchOf(call: z.infer<typeof ToolCallShape>) {
  return withoutUndefined(allFieldsOf(call));
}

function allFieldsOf(call: z.infer<typeof ToolCallShape>) {
  const command = CommandInput.safeParse(call.rawInput);
  return {
    toolCallId: call.toolCallId,
    title: call.title,
    kind: call.kind === undefined ? undefined : (KINDS.get(call.kind) ?? "other"),
    status: call.status === undefined ? undefined : STATUSES.get(call.status),
    paths: pathsOf(call),
    files: filesOf(call.content),
    command: command.success ? [command.data.command].flat().join(" ") : undefined,
    input: call.rawInput,
  };
}

/** The tool call described for the user, with defaults for what the agent left out. */
export function describeTool(raw: unknown): ToolDescription | undefined {
  const call = ToolCallShape.safeParse(raw);
  if (!call.success) return undefined;
  const patch = patchOf(call.data);
  return {
    ...patch,
    title: patch.title ?? "Tool call",
    kind: patch.kind ?? "other",
    status: patch.status ?? "pending",
  };
}

/** ACP `tool_call`: a tool call has started. */
export function toolStarted(update: unknown): AgentUpdate[] | undefined {
  const tool = describeTool(update);
  return tool && [{ type: "tool-started", ...tool }];
}

/** ACP `tool_call_update`: only the fields the agent sent are set. */
export function toolUpdated(update: unknown): AgentUpdate[] | undefined {
  const call = ToolCallShape.safeParse(update);
  return call.success ? [{ type: "tool-updated", ...patchOf(call.data) }] : undefined;
}
