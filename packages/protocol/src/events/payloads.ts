import { z } from "zod";
import { AgentKind } from "../ids/index.ts";

/** A raw ACP JSON-RPC message, kept unchanged; only the version marker is checked. */
export const RawAcpMessage = z.looseObject({ jsonrpc: z.literal("2.0") });
export type RawAcpMessage = z.infer<typeof RawAcpMessage>;

/** Payload of an "acp" event: one ACP message and which way it travelled. */
export const AcpPayload = z.object({
  direction: z.enum(["to-agent", "from-agent"]),
  message: RawAcpMessage,
});

/** Payload of "session-created": everything needed to show and rebuild the session. */
export const SessionCreatedPayload = z.object({
  agent: AgentKind,
  repoPath: z.string(),
  baseBranch: z.string(),
  branch: z.string(),
  worktreePath: z.string(),
  title: z.string(),
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

/** Payload of "permission-requested": the agent wants an answer from the user. */
export const PermissionRequestedPayload = z.object({
  requestId: z.string(),
  toolCall: z.unknown(),
  options: z.array(PermissionOption),
});

/** Payload of "permission-answered": the chosen option, or a cancellation. */
export const PermissionAnsweredPayload = z.union([
  z.object({ requestId: z.string(), optionId: z.string() }),
  z.object({ requestId: z.string(), cancelled: z.literal(true) }),
]);

/** Payload of "prompt-sent": the user's message to the agent. */
export const PromptSentPayload = z.object({ text: z.string() });

/** Payload of "turn-ended": the ACP stop reason of the finished turn. */
export const TurnEndedPayload = z.object({ stopReason: z.string() });

/** Payload for events that carry nothing ("agent-started", "session-archived"). */
export const EmptyPayload = z.object({});
