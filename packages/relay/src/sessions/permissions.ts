import { ErrorCode, type PermissionPolicy, type SessionId } from "@agentcontrol/protocol";
import type { PermissionAnswer, PermissionRequest } from "../agents/index.ts";
import { RelayError } from "../rpc/index.ts";
import { type SessionContext, sessionInfo } from "./context.ts";
import { decidePermission } from "./policy.ts";

/** The agent asked: record the request, then hold the agent until the user answers. */
export async function holdForUser(
  ctx: SessionContext,
  call: { sessionId: SessionId; request: PermissionRequest },
): Promise<PermissionAnswer> {
  const { sessionId, request } = call;
  const answer = ctx.permissions.hold(sessionId, request);
  await ctx.log.append(sessionId, {
    kind: "permission-requested",
    payload: { requestId: request.requestId, toolCall: request.toolCall, options: request.options },
  });
  return answer;
}

/** Records the user's choice, then lets the agent carry on. */
export async function answerRequest(
  ctx: SessionContext,
  call: { sessionId: SessionId; requestId: string; optionId: string },
): Promise<void> {
  const { sessionId, requestId, optionId } = call;
  await sessionInfo(ctx, sessionId);
  const known = ctx.permissions.pending(sessionId).some((r) => r.requestId === requestId);
  if (!known) {
    throw new RelayError(
      ErrorCode.invalidParams,
      "That request is no longer waiting for an answer.",
    );
  }
  await ctx.log.append(sessionId, {
    kind: "permission-answered",
    payload: { requestId, optionId },
  });
  ctx.permissions.answer(sessionId, requestId, { optionId });
}

/** Cancels every request the session is waiting on, recording each one. */
export async function cancelRequests(ctx: SessionContext, sessionId: SessionId): Promise<void> {
  const pending = ctx.permissions.pending(sessionId);
  for (const { requestId } of pending) {
    await ctx.log.append(sessionId, {
      kind: "permission-answered",
      payload: { requestId, cancelled: true },
    });
  }
  ctx.permissions.cancelAll(sessionId);
}

/**
 * A directory session's request: the relay decides under the policy, never the agent or the user.
 * Both the request and the automatic answer, with its reason, go into the log.
 */
export async function answerByPolicy(
  ctx: SessionContext,
  call: { sessionId: SessionId; request: PermissionRequest; policy: PermissionPolicy; cwd: string },
): Promise<PermissionAnswer> {
  const { sessionId, request } = call;
  const { answer, reason } = await decidePermission(call);
  await ctx.log.append(sessionId, {
    kind: "permission-requested",
    payload: { requestId: request.requestId, toolCall: request.toolCall, options: request.options },
  });
  await ctx.log.append(sessionId, {
    kind: "permission-answered",
    payload: { requestId: request.requestId, ...answer, automatic: { reason } },
  });
  return answer;
}
