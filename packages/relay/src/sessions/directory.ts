import { realpath, stat } from "node:fs/promises";
import {
  type DirectorySessionParams,
  ErrorCode,
  type PermissionPolicy,
  SessionId,
} from "@agentcontrol/protocol";
import { RelayError } from "../rpc/index.ts";
import type { SessionContext } from "./context.ts";
import { answerByPolicy } from "./permissions.ts";
import { restrictionsFor } from "./restrictions.ts";
import { launchAgent } from "./start.ts";
import { startTurn } from "./turn.ts";

interface DirectorySession {
  sessionId: SessionId;
  cwd: string;
  params: DirectorySessionParams;
  policy: PermissionPolicy;
}

async function folderOf(path: string): Promise<string> {
  const real = await realpath(path).catch(() => undefined);
  if (real === undefined || !(await stat(real)).isDirectory()) {
    throw new RelayError(ErrorCode.invalidParams, `"${path}" is not a folder that exists.`);
  }
  return real;
}

async function runDirectorySession(ctx: SessionContext, session: DirectorySession) {
  const { sessionId, cwd, params, policy } = session;
  const sessionMeta = restrictionsFor(params.agent);
  const agent = await launchAgent(ctx, {
    sessionId,
    agent: params.agent,
    cwd,
    env: {},
    ...(sessionMeta ? { sessionMeta } : {}),
    ask: (request) => answerByPolicy(ctx, { sessionId, request, policy, cwd }),
  });
  if (agent) await startTurn(ctx, { sessionId, agent, text: params.prompt });
}

/**
 * A session that runs the agent in a plain folder, with no git worktree. The relay answers every
 * permission request itself, under `permissionPolicy`. Listed with `kind: "directory"`.
 */
export async function createDirectorySession(
  ctx: SessionContext,
  params: DirectorySessionParams,
): Promise<SessionId> {
  const sessionId = SessionId.parse(crypto.randomUUID());
  const cwd = await folderOf(params.cwd);
  const policy = { allowEditsUnder: await folderOf(params.permissionPolicy.allowEditsUnder) };
  const title = (params.title ?? params.prompt.split("\n")[0] ?? "").slice(0, 80);
  const created = { agent: params.agent, repoPath: cwd, baseBranch: "", branch: "" };
  await ctx.log.append(sessionId, {
    kind: "session-created",
    payload: { ...created, worktreePath: cwd, title, kind: "directory" },
  });
  await ctx.log.append(sessionId, { kind: "setup-finished", payload: { exitCode: 0 } });
  const unexpected = `Session ${sessionId} failed unexpectedly:`;
  runDirectorySession(ctx, { sessionId, cwd, params, policy }).catch(
    console.error.bind(console, unexpected),
  );
  return sessionId;
}
