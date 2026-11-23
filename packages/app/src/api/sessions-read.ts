import { RelayName as N, SessionId } from "@agentcontrol/protocol";
import { Hono } from "hono";
import { z } from "zod";
import type { ApiDeps } from "./deps.ts";
import { locateSession, routeRequest } from "./routing.ts";
import { validate } from "./validate.ts";

const IdParam = z.object({ id: SessionId });
const ListQuery = z.object({ archived: z.enum(["true", "false"]).optional() });
const Count = z.string().regex(/^\d+$/);
const EventsQuery = z.object({ after: Count.optional(), limit: Count.optional() });

/** Reads of the session list and history (from the app's store) and of token usage (from the relay). */
export function sessionReadRoutes(deps: ApiDeps) {
  const { store } = deps;
  return new Hono()
    .get("/", validate("query", ListQuery), (c) => {
      const { archived } = c.req.valid("query");
      const filter = archived === undefined ? {} : { archived: archived === "true" };
      const listed = store.listSessions(filter);
      return c.json({ sessions: listed.filter((session) => session.kind !== "directory") });
    })
    .get("/:id", validate("param", IdParam), (c) =>
      c.json(locateSession(deps, c.req.valid("param").id)),
    )
    .get("/:id/events", validate("param", IdParam), validate("query", EventsQuery), (c) => {
      const { id } = c.req.valid("param");
      const { after, limit } = c.req.valid("query");
      const { workspaceId } = locateSession(deps, id);
      const query = { workspaceId, sessionId: id, afterSeq: Number(after ?? 0) };
      return c.json({
        events: store.eventsAfter(limit ? { ...query, limit: Number(limit) } : query),
      });
    })
    .get("/:id/usage", validate("param", IdParam), async (c) => {
      const { id } = c.req.valid("param");
      const { link } = routeRequest(deps, { sessionId: id });
      return c.json(await link.call(N.usage, { sessionId: id }));
    });
}
