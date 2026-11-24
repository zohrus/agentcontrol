import { z } from "zod";
import { AgentKind, SessionId } from "../ids/index.ts";
import { SessionSummary } from "./summary.ts";

const Empty = z.object({});

/** Params of relay/sessions.list. */
export const SessionsListParams = Empty;
/** Result of relay/sessions.list. */
export const SessionsListResult = z.object({ sessions: z.array(SessionSummary) });

/** Params of relay/sessions.create for a session in its own git worktree. */
export const WorktreeSessionParams = z.object({
  agent: AgentKind,
  repoPath: z.string(),
  /**
   * The branch (local or remote) the worktree starts from. Left out, it starts from the latest
   * trunk of the repository's remote; the relay says what it used in the session's setup lines.
   */
  baseBranch: z.string().optional(),
  /** The first message. Left out, the session is created and made ready, and the user sends it later. */
  prompt: z.string().optional(),
  title: z.string().optional(),
  model: z.string().optional(),
});

/** What a directory session's agent may do: the relay answers every permission request itself. */
export const PermissionPolicy = z.object({
  /** File edits are allowed only when every path they touch resolves inside this folder. */
  allowEditsUnder: z.string(),
});

/** Params of relay/sessions.create for an agent that runs in a plain folder, with a fence. */
export const DirectorySessionParams = z.object({
  kind: z.literal("directory"),
  agent: AgentKind,
  cwd: z.string(),
  prompt: z.string(),
  title: z.string().optional(),
  permissionPolicy: PermissionPolicy,
});

/** Params of relay/sessions.create: a worktree session (no `kind`) or a directory session. */
export const SessionsCreateParams = z.union([DirectorySessionParams, WorktreeSessionParams]);
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

/** Params of relay/sessions.resume. */
export const SessionsResumeParams = z.object({ sessionId: SessionId });
/** Result of relay/sessions.resume: whether the new agent remembers the earlier conversation. */
export const SessionsResumeResult = z.object({ contextRestored: z.boolean() });

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

export type SessionsListResult = z.infer<typeof SessionsListResult>;
export type SessionsCreateParams = z.infer<typeof SessionsCreateParams>;
export type WorktreeSessionParams = z.infer<typeof WorktreeSessionParams>;
export type DirectorySessionParams = z.infer<typeof DirectorySessionParams>;
export type PermissionPolicy = z.infer<typeof PermissionPolicy>;
export type SessionsCreateResult = z.infer<typeof SessionsCreateResult>;
export type PromptParams = z.infer<typeof PromptParams>;
export type PermissionRespondParams = z.infer<typeof PermissionRespondParams>;
export type CancelParams = z.infer<typeof CancelParams>;
export type SessionsResumeResult = z.infer<typeof SessionsResumeResult>;
export type SessionsArchiveParams = z.infer<typeof SessionsArchiveParams>;
export type SessionsArchiveResult = z.infer<typeof SessionsArchiveResult>;
