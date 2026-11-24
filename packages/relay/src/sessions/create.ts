import { ErrorCode, SessionId, type WorktreeSessionParams } from "@agentcontrol/protocol";
import type { RepoWithSetup } from "../repos/index.ts";
import { RelayError } from "../rpc/index.ts";
import { checkBaseBranch, namedBase, planWorktree, portBaseFor } from "../worktrees/index.ts";
import type { SessionContext } from "./context.ts";
import { runInBackground } from "./start.ts";

function titleOf(params: WorktreeSessionParams): string {
  const firstLine = params.title ?? params.prompt?.split("\n")[0] ?? "";
  return firstLine.slice(0, 80);
}

/** The id the client chose, or a new one; a session with that id must not exist yet. */
function idFor(ctx: SessionContext, params: WorktreeSessionParams): SessionId {
  const sessionId = params.sessionId ?? SessionId.parse(crypto.randomUUID());
  if (ctx.claimed.has(sessionId) || ctx.summaries.created(sessionId) !== undefined) {
    throw new RelayError(ErrorCode.invalidParams, `Session "${sessionId}" exists already.`);
  }
  ctx.claimed.add(sessionId);
  return sessionId;
}

async function repoOf(ctx: SessionContext, path: string): Promise<RepoWithSetup> {
  return (await ctx.repos.findByPath(path)) ?? (await ctx.repos.add(path));
}

async function createClaimed(
  ctx: SessionContext,
  call: { sessionId: SessionId; params: WorktreeSessionParams },
): Promise<SessionId> {
  const { sessionId, params } = call;
  const repo = await repoOf(ctx, params.repoPath);
  const named = namedBase(params.baseBranch);
  if (named !== "") await checkBaseBranch(repo.path, named);
  const planned = {
    sessionId,
    worktreesDir: ctx.worktreesDir,
    portBase: portBaseFor(ctx.nextPortIndex()),
  };
  const worktree = planWorktree(planned);
  const { worktreePath, branch, portBase } = worktree;
  const created = { agent: params.agent, repoPath: repo.path, baseBranch: named };
  await ctx.log.append(sessionId, {
    kind: "session-created",
    payload: { ...created, title: titleOf(params), worktreePath, branch, portBase },
  });
  runInBackground(ctx, { sessionId, repo, params, worktree });
  return sessionId;
}

/**
 * Creates a session in its own worktree: records `session-created` at once and returns. Finding
 * the latest trunk, making the worktree, the setup script and the agent all happen afterwards, shown
 * as events of the session. A base branch the user named that git does not know is refused here,
 * because that is quick to find out; the id is then free to be used again.
 */
export async function createWorktreeSession(
  ctx: SessionContext,
  params: WorktreeSessionParams,
): Promise<SessionId> {
  const sessionId = idFor(ctx, params);
  try {
    return await createClaimed(ctx, { sessionId, params });
  } finally {
    // Once `session-created` is recorded the session itself says the id is taken.
    ctx.claimed.delete(sessionId);
  }
}
