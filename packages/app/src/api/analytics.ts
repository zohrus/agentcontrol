import { Hono } from "hono";
import { createAnalytics, FilterQuery, TableQuery } from "../analytics/index.ts";
import type { ApiDeps } from "./deps.ts";
import { validate } from "./validate.ts";

/** What the sessions cost and how they went, from what the app has saved (works with a workspace offline). */
export function analyticsRoutes(deps: ApiDeps) {
  const analytics = createAnalytics({ store: deps.store });
  return new Hono()
    .get("/summary", validate("query", FilterQuery), (c) =>
      c.json(analytics.summary(c.req.valid("query"))),
    )
    .get("/sessions", validate("query", TableQuery), (c) =>
      c.json({ sessions: analytics.sessions(c.req.valid("query")) }),
    )
    .get("/insights", validate("query", FilterQuery), (c) =>
      c.json({ insights: analytics.insights(c.req.valid("query")) }),
    );
}
