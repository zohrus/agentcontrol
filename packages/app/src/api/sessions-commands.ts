import {
  PermissionRespondParams,
  RelayName as N,
  SessionId,
  WorktreeSessionParams,
} from "@agentcontrol/protocol";
import { Hono } from "hono";
import { z } from "zod";
import type { Link } from "../sync/index.ts";
import type { ApiDeps } from "./deps.ts";
import { ApiFailure } from "./errors.ts";
import { routeRequest, WorkspaceQuery } from "./routing.ts";
import { validate } from "./validate.ts";

const IdParam = z.object({ id: SessionId });
const PromptBody = z.object({ text: z.string().min(1) });
const AnswerParams = z.object({ id: SessionId, requestId: z.string().min(1) });
const AnswerBody = PermissionRespondParams.pick({ optionId: true });
const ArchiveBody = z.object({ force: z.boolean().optional() });

/** Starting a session, on the workspace given by `?workspace=<id>` (this Mac by default). */
export function sessionStartRoute(deps: ApiDeps) {
  return new Hono().post(
    "/",
    validate("query", WorkspaceQuery),
    validate("json", WorktreeSessionParams),
    async (c) => {
      const { link } = routeRequest(deps, { workspaceId: c.req.valid("query").workspace });
      const { sessionId } = await link.call(N.sessionsCreate, c.req.valid("json"));
      await link.refreshSessions();
      return c.json({ sessionId }, 201);
    },
  );
}

/** Talking with a session's agent: replies and permission answers. */
export function sessionConversationRoutes(deps: ApiDeps) {
  const relay = (sessionId: SessionId): Link => routeRequest(deps, { sessionId }).link;
  return new Hono()
    .post("/:id/prompt", validate("param", IdParam), validate("json", PromptBody), async (c) => {
      const { text } = c.req.valid("json");
      const sessionId = c.req.valid("param").id;
      await relay(sessionId).call(N.prompt, { sessionId, text });
      return c.json({});
    })
    .post(
      "/:id/permissions/:requestId",
      validate("param", AnswerParams),
      validate("json", AnswerBody),
      async (c) => {
        const { id: sessionId, requestId } = c.req.valid("param");
        const { optionId } = c.req.valid("json");
        await relay(sessionId).call(N.permissionRespond, { sessionId, requestId, optionId });
        return c.json({});
      },
    );
}

/** Ending work on a session: cancel the turn, or archive the session. */
export function sessionControlRoutes(deps: ApiDeps) {
  const relay = (sessionId: SessionId): Link => routeRequest(deps, { sessionId }).link;
  return new Hono()
    .post("/:id/cancel", validate("param", IdParam), async (c) => {
      const sessionId = c.req.valid("param").id;
      await relay(sessionId).call(N.cancel, { sessionId });
      return c.json({});
    })
    .post("/:id/archive", validate("param", IdParam), validate("json", ArchiveBody), async (c) => {
      const { force } = c.req.valid("json");
      const sessionId = c.req.valid("param").id;
      const result = await relay(sessionId).call(N.sessionsArchive, { sessionId, force });
      if (result.archived) return c.json({ archived: true });
      const message = "The worktree has uncommitted changes.";
      throw new ApiFailure(409, { code: "uncommitted-changes", message, data: result });
    });
}
