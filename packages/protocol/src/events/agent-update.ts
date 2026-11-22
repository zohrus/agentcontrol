import { z } from "zod";

/**
 * One changed file of a tool call. Either the text before and after (a diff the UI can render),
 * or only the counts when the agent did not send the text. A missing `oldText` means a new file.
 */
export const FileChange = z.union([
  z.object({ path: z.string(), oldText: z.string().optional(), newText: z.string() }),
  z.object({ path: z.string(), additions: z.number().int(), deletions: z.number().int() }),
]);
export type FileChange = z.infer<typeof FileChange>;

/** What a tool does, in words every agent shares. */
export const ToolKind = z.enum(["read", "search", "edit", "execute", "fetch", "think", "other"]);
export type ToolKind = z.infer<typeof ToolKind>;

/** Where a tool call is in its life. */
export const ToolStatus = z.enum(["pending", "running", "completed", "failed"]);
export type ToolStatus = z.infer<typeof ToolStatus>;

/** One tool call as the user should see it: what it is, what it changes, what it was given. */
export const ToolDescription = z.object({
  toolCallId: z.string(),
  title: z.string(),
  kind: ToolKind,
  status: ToolStatus,
  /** Files the call changes, when known. */
  files: z.array(FileChange).optional(),
  /** The shell command, for `execute` calls that have one. */
  command: z.string().optional(),
  /** The tool's input exactly as the agent sent it; for display only, its shape is agent specific. */
  input: z.unknown().optional(),
});
export type ToolDescription = z.infer<typeof ToolDescription>;

/** A later message about a known tool call: only what changed is present. */
const ToolPatch = ToolDescription.partial().required({ toolCallId: true });

/** One entry of the agent's plan. */
export const PlanEntry = z.object({
  content: z.string(),
  status: z.enum(["pending", "in_progress", "completed"]),
});
export type PlanEntry = z.infer<typeof PlanEntry>;

const text = { text: z.string(), messageId: z.string().optional() };

/**
 * What an agent did or said, in a form that no agent or protocol leaks into. The relay computes it
 * from the raw message (`AcpPayload.message`, kept unchanged in the log) when it serves an event, so
 * the UI, usage and analytics read this and never the raw shape. Discriminated on `type`.
 */
export const AgentUpdate = z.discriminatedUnion("type", [
  /** The user's message to the agent. */
  z.object({ type: z.literal("user-text"), ...text }),
  /** A piece of the agent's reply; chunks that share a `messageId` form one message. */
  z.object({ type: z.literal("agent-text"), ...text }),
  /** A piece of the agent's reasoning. */
  z.object({ type: z.literal("agent-thought"), ...text }),
  /** The agent's checklist; each plan replaces the previous one. */
  z.object({ type: z.literal("plan"), entries: z.array(PlanEntry) }),
  /** The agent started a tool call. */
  z.object({ type: z.literal("tool-started"), ...ToolDescription.shape }),
  /** More is known about a tool call: a new status, title, input or diff. */
  z.object({ type: z.literal("tool-updated"), ...ToolPatch.shape }),
  /** The agent works in a different mode (for example "plan" or "acceptEdits"). */
  z.object({ type: z.literal("mode-changed"), modeId: z.string() }),
  /** Fire-and-forget information for the user, such as a connection problem. */
  z.object({
    type: z.literal("notice"),
    text: z.string(),
    severity: z.enum(["info", "warning", "error"]),
  }),
  /** Where the session stands: context window use and the cumulative cost so far. */
  z.object({
    type: z.literal("usage"),
    contextUsed: z.number().optional(),
    contextSize: z.number().optional(),
    /** Cumulative cost of the whole session in US dollars. */
    costUsd: z.number().optional(),
    model: z.string().optional(),
  }),
  /** Tokens one finished turn used (summable across turns). */
  z.object({
    type: z.literal("turn-usage"),
    model: z.string().optional(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    cacheReadTokens: z.number(),
    cacheWriteTokens: z.number(),
  }),
  /** The turn is over; `stopReason` is "end_turn", "cancelled", "refusal" and so on. */
  z.object({ type: z.literal("turn-ended"), stopReason: z.string() }),
  /** A message the relay does not interpret; `name` is the agent's own name for it. */
  z.object({ type: z.literal("other"), name: z.string() }),
]);
export type AgentUpdate = z.infer<typeof AgentUpdate>;
