import { z } from "zod";
import { AgentKind, SessionId } from "../ids/index.ts";
import { SessionSummary } from "./summary.ts";

const Empty = z.object({});

/** Params of relay/sessions.list. */
export const SessionsListParams = Empty;
/** Result of relay/sessions.list. */
export const SessionsListResult = z.object({ sessions: z.array(SessionSummary) });

/** Params of relay/sessions.create. */
export const SessionsCreateParams = z.object({
  agent: AgentKind,
  repoPath: z.string(),
  baseBranch: z.string(),
  prompt: z.string(),
  title: z.string().optional(),
  model: z.string().optional(),
});
/** Result of relay/sessions.create. */
export const SessionsCreateResult = z.object({ sessionId: SessionId });

/** Params of relay/prompt. */
export const PromptParams = z.object({ sessionId: SessionId, text: z.string() });
/** Result of relay/prompt, relay/permission.respond and relay/cancel. */
export const AckResult = Empty;

/** Params of relay/permission.respond. */
export const PermissionRespondParams = z.object({
  sessionId: SessionId,
  requestId: z.string(),
  optionId: z.string(),
});

/** Params of relay/cancel. */
export const CancelParams = z.object({ sessionId: SessionId });

/** Params of relay/sessions.archive. */
export const SessionsArchiveParams = z.object({
  sessionId: SessionId,
  force: z.boolean().optional(),
});
/** Result of relay/sessions.archive: done, or the uncommitted files that blocked it. */
export const SessionsArchiveResult = z.discriminatedUnion("archived", [
  z.object({ archived: z.literal(true) }),
  z.object({ archived: z.literal(false), uncommittedFiles: z.array(z.string()) }),
]);
