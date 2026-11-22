import {
  PermissionRespondParams,
  RelayName as N,
  SessionId,
  SessionsCreateParams,
} from "@agentcontrol/protocol";
import { Hono } from "hono";
import { z } from "zod";
import type { Link } from "../sync/index.ts";
import type { ApiDeps } from "./deps.ts";
import { ApiFailure } from "./errors.ts";
import { routeRequest } from "./routing.ts";
import { validate } from "./validate.ts";

const IdParam = z.object({ id: SessionId });
const PromptBody = z.object({ text: z.string().min(1) });
const AnswerParams = z.object({ id: SessionId, requestId: z.string().min(1) });
const AnswerBody = PermissionRespondParams.pick({ optionId: true });
const ArchiveBody = z.object({ force: z.boolean().optional() });

/** Starting a session and talking with its agent: first prompt, replies, permission answers. */
export function sessionConversationRoutes(deps: ApiDeps) {
  const relay = (): Link => routeRequest(deps).link;
  return new Hono()
    .post("/", validate("json", SessionsCreateParams), async (c) => {
      const { sessionId } = await relay().call(N.sessionsCreate, c.req.valid("json"));
      await relay().refreshSessions();
      return c.json({ sessionId }, 201);
    })
    .post("/:id/prompt", validate("param", IdParam), validate("json", PromptBody), async (c) => {
      const { text } = c.req.valid("json");
      await relay().call(N.prompt, { sessionId: c.req.valid("param").id, text });
      return c.json({});
    })
    .post(
      "/:id/permissions/:requestId",
      validate("param", AnswerParams),
      validate("json", AnswerBody),
      async (c) => {
        const { id: sessionId, requestId } = c.req.valid("param");
        const { optionId } = c.req.valid("json");
        await relay().call(N.permissionRespond, { sessionId, requestId, optionId });
        return c.json({});
      },
    );
}

/** Ending work on a session: cancel the turn, or archive the session. */
export function sessionControlRoutes(deps: ApiDeps) {
  const relay = (): Link => routeRequest(deps).link;
  return new Hono()
    .post("/:id/cancel", validate("param", IdParam), async (c) => {
      await relay().call(N.cancel, { sessionId: c.req.valid("param").id });
      return c.json({});
    })
    .post("/:id/archive", validate("param", IdParam), validate("json", ArchiveBody), async (c) => {
      const { force } = c.req.valid("json");
      const sessionId = c.req.valid("param").id;
      const result = await relay().call(N.sessionsArchive, { sessionId, force });
      if (result.archived) return c.json({ archived: true });
      const message = "The worktree has uncommitted changes.";
      throw new ApiFailure(409, { code: "uncommitted-changes", message, data: result });
    });
}
