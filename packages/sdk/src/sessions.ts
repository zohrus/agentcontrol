import type {
  DiffResult,
  SessionEvent,
  SessionId,
  SessionsCreateParams,
} from "@agentcontrol/protocol";
import { read } from "./api-error.ts";
import type { Api } from "./client-type.ts";
import type { SessionRow, UsageRow } from "./types.ts";

export interface StartSession {
  /** Which agent to run: "claude-code", "codex" (or "mock" in tests). */
  agent: SessionsCreateParams["agent"];
  /** Absolute path of the git repo to work in. */
  repoPath: string;
  /** The branch the session's worktree starts from, e.g. "main". */
  baseBranch: string;
  /** The first message to the agent. */
  prompt: string;
  /** A short name for the session list; defaults to the prompt. */
  title?: string;
}

const flag = (value: boolean) => (value ? ("true" as const) : ("false" as const));

/** Reading sessions: the list, one session, its history and its diff. */
function sessionReads(api: Api) {
  return {
    /** Sessions newest first. Pass `archived: true` to list archived ones instead of active ones. */
    list: async (options: { archived?: boolean } = {}): Promise<SessionRow[]> => {
      const query = options.archived === undefined ? {} : { archived: flag(options.archived) };
      const { sessions } = await read(api.sessions.$get({ query }));
      return sessions;
    },
    /** One session's summary: status, waiting reason, title, branch. Throws ApiError "session-not-found". */
    get: (id: SessionId): Promise<SessionRow> => read(api.sessions[":id"].$get({ param: { id } })),
    /** A session's events with `seq` greater than `after` (default 0), in order. Use it to catch up. */
    events: async (
      id: SessionId,
      options: { after?: number; limit?: number } = {},
    ): Promise<SessionEvent[]> => {
      const query = {
        after: String(options.after ?? 0),
        ...(options.limit === undefined ? {} : { limit: String(options.limit) }),
      };
      const { events } = await read(api.sessions[":id"].events.$get({ param: { id }, query }));
      return events;
    },
    /** Every change since the base branch, committed or not, as parsed per-file hunks. */
    diff: (id: SessionId): Promise<DiffResult> =>
      read(api.sessions[":id"].diff.$get({ param: { id } })),
  };
}

/** What sessions cost. */
function sessionCosts(api: Api) {
  return {
    /** One row per finished turn with its tokens and cost, oldest first. */
    usage: async (id: SessionId): Promise<UsageRow[]> => {
      const { rows } = await read(api.sessions[":id"].usage.$get({ param: { id } }));
      return rows;
    },
  };
}

/** Acting on sessions: start, talk to the agent, answer permissions, cancel, archive. */
function sessionActions(api: Api) {
  return {
    /** Starts a session in a new git worktree and sends the first prompt. Resolves with its id. */
    start: async (session: StartSession): Promise<SessionId> => {
      const { sessionId } = await read(api.sessions.$post({ json: session }));
      return sessionId;
    },
    /** Sends the user's next message to the agent. */
    sendPrompt: async (id: SessionId, text: string): Promise<void> => {
      await read(api.sessions[":id"].prompt.$post({ param: { id }, json: { text } }));
    },
    /** Answers an agent's permission request with one of the offered option ids (a PermissionOption). */
    answerPermission: async (id: SessionId, requestId: string, optionId: string): Promise<void> => {
      const param = { id, requestId };
      await read(
        api.sessions[":id"].permissions[":requestId"].$post({ param, json: { optionId } }),
      );
    },
  };
}

/** Stopping work: cancel the current turn, or archive the whole session. */
function sessionEnding(api: Api) {
  return {
    /** Asks the agent to stop what it is doing in this turn. */
    cancel: async (id: SessionId): Promise<void> => {
      await read(api.sessions[":id"].cancel.$post({ param: { id } }));
    },
    /**
     * Stops the agent and removes the worktree, keeping the branch and history. Throws ApiError
     * "uncommitted-changes" (data.uncommittedFiles) unless `force` is true.
     */
    archive: async (id: SessionId, options: { force?: boolean } = {}): Promise<void> => {
      await read(api.sessions[":id"].archive.$post({ param: { id }, json: options }));
    },
  };
}

/** Everything about sessions: list them, start one, read history, talk to the agent, archive. */
export function sessionsApi(api: Api) {
  return {
    ...sessionReads(api),
    ...sessionCosts(api),
    ...sessionActions(api),
    ...sessionEnding(api),
  };
}
