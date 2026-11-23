import { FsReadParams, FsWriteParams, RelayName as N, SessionId } from "@agentcontrol/protocol";
import { Hono } from "hono";
import { z } from "zod";
import type { Link } from "../sync/index.ts";
import type { ApiDeps } from "./deps.ts";
import { routeRequest } from "./routing.ts";
import { validate } from "./validate.ts";

const IdParam = z.object({ id: SessionId });
const ReadQuery = FsReadParams.pick({ path: true, ref: true });
const WriteBody = FsWriteParams.pick({ path: true, content: true, expectedHash: true });

/** A session's diff and worktree files. Writes fail with 409 when the file changed meanwhile. */
export function fileRoutes(deps: ApiDeps) {
  const relay = (sessionId: SessionId): Link => routeRequest(deps, { sessionId }).link;
  return new Hono()
    .get("/:id/diff", validate("param", IdParam), async (c) => {
      const { id: sessionId } = c.req.valid("param");
      return c.json(await relay(sessionId).call(N.diff, { sessionId }));
    })
    .get("/:id/files", validate("param", IdParam), async (c) => {
      const { id: sessionId } = c.req.valid("param");
      await relay(sessionId).watchFiles(sessionId);
      return c.json(await relay(sessionId).call(N.fsTree, { sessionId }));
    })
    .get("/:id/file", validate("param", IdParam), validate("query", ReadQuery), async (c) => {
      const sessionId = c.req.valid("param").id;
      return c.json(await relay(sessionId).call(N.fsRead, { sessionId, ...c.req.valid("query") }));
    })
    .put("/:id/file", validate("param", IdParam), validate("json", WriteBody), async (c) => {
      const sessionId = c.req.valid("param").id;
      return c.json(await relay(sessionId).call(N.fsWrite, { sessionId, ...c.req.valid("json") }));
    });
}
