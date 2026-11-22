import { SessionId } from "@agentcontrol/protocol";
import { Hono } from "hono";
import { z } from "zod";
import type { Store } from "../store/index.ts";
import type { ApiDeps } from "./deps.ts";
import { ApiFailure } from "./errors.ts";
import { validate } from "./validate.ts";

const IdParam = z.object({ id: SessionId });
const ListQuery = z.object({ archived: z.enum(["true", "false"]).optional() });
const Count = z.string().regex(/^\d+$/);
const EventsQuery = z.object({ after: Count.optional(), limit: Count.optional() });

function requireSession(store: Store, id: SessionId) {
  const session = store.getSession(id);
  if (!session)
    throw new ApiFailure(404, { code: "session-not-found", message: `No session ${id}.` });
  return session;
}

/** Reads of the session list and history, served from the app's own store. */
export function sessionReadRoutes({ store }: ApiDeps) {
  return new Hono()
    .get("/", validate("query", ListQuery), (c) => {
      const { archived } = c.req.valid("query");
      const filter = archived === undefined ? {} : { archived: archived === "true" };
      return c.json({ sessions: store.listSessions(filter) });
    })
    .get("/:id", validate("param", IdParam), (c) =>
      c.json(requireSession(store, c.req.valid("param").id)),
    )
    .get("/:id/events", validate("param", IdParam), validate("query", EventsQuery), (c) => {
      const { id } = c.req.valid("param");
      const { after, limit } = c.req.valid("query");
      requireSession(store, id);
      const query = { sessionId: id, afterSeq: Number(after ?? 0) };
      return c.json({
        events: store.eventsAfter(limit ? { ...query, limit: Number(limit) } : query),
      });
    });
}
