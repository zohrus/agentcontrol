import { z } from "zod";
import { AgentKind, SessionKind } from "../ids/index.ts";
import { AgentUpdate, ToolDescription } from "./agent-update.ts";

/** A raw ACP JSON-RPC message, kept unchanged; only the version marker is checked. */
export const RawAcpMessage = z.looseObject({ jsonrpc: z.literal("2.0") });
export type RawAcpMessage = z.infer<typeof RawAcpMessage>;

/**
 * Payload of an "acp" event: one ACP message and which way it travelled. `message` is stored
 * unchanged; `updates` is what the relay made of it when it served the event, never stored.
 * Read `updates`, not `message`.
 */
export const AcpPayload = z.object({
  direction: z.enum(["to-agent", "from-agent"]),
  message: RawAcpMessage,
  updates: z.array(AgentUpdate).optional(),
});

/** Payload of "session-created": everything needed to show and rebuild the session. */
export const SessionCreatedPayload = z.object({
  agent: AgentKind,
  repoPath: z.string(),
  baseBranch: z.string(),
  branch: z.string(),
  worktreePath: z.string(),
  title: z.string(),
  /** Absent means "worktree". A directory session has no branch; `worktreePath` is its folder. */
  kind: SessionKind.optional(),
});

/** Payload of "setup-output": one chunk of the worktree setup script's output. */
export const SetupOutputPayload = z.object({
  stream: z.enum(["stdout", "stderr"]),
  text: z.string(),
});

/** Payload of "setup-finished": how the setup script ended. */
export const SetupFinishedPayload = z.object({ exitCode: z.number().int() });

/** Payload of "agent-exited": how the agent process ended. */
export const AgentExitedPayload = z.object({
  exitCode: z.number().int().nullable(),
  signal: z.string().optional(),
});

/** One choice offered with a permission request. */
export const PermissionOption = z.object({
  optionId: z.string(),
  name: z.string(),
  kind: z.string(),
});
export type PermissionOption = z.infer<typeof PermissionOption>;

/**
 * Payload of "permission-requested": the agent wants an answer from the user. `toolCall` is the raw
 * ACP value, stored unchanged; `tool` is the same call described like a tool update, added by the
 * relay when it serves the event, never stored. Read `tool`, not `toolCall`.
 */
export const PermissionRequestedPayload = z.object({
  requestId: z.string(),
  toolCall: z.unknown(),
  tool: ToolDescription.optional(),
  options: z.array(PermissionOption),
});

/** Set on an answer the relay gave by itself under a permission policy, with the reason. */
export const AutomaticAnswer = z.object({ reason: z.string() });

/** Payload of "permission-answered": the chosen option, or a cancellation. */
export const PermissionAnsweredPayload = z.union([
  z.object({ requestId: z.string(), optionId: z.string(), automatic: AutomaticAnswer.optional() }),
  z.object({
    requestId: z.string(),
    cancelled: z.literal(true),
    automatic: AutomaticAnswer.optional(),
  }),
]);

/** Payload of "prompt-sent": the user's message to the agent. */
export const PromptSentPayload = z.object({ text: z.string() });

/** Payload of "turn-ended": the ACP stop reason of the finished turn. */
export const TurnEndedPayload = z.object({ stopReason: z.string() });

/** Payload for events that carry nothing ("agent-started", "session-archived"). */
export const EmptyPayload = z.object({});
