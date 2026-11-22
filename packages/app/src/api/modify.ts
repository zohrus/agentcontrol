import { Hono } from "hono";
import { z } from "zod";
import type { ApiDeps } from "./deps.ts";
import { validate } from "./validate.ts";

const RequestBody = z.object({ request: z.string().min(1) });
const RestoreBody = z.object({ commit: z.string().min(1) });

/** The Modify agent: ask for a change, follow it, Keep or Undo it, and the UI's version history. */
export function modifyRoutes({ modify }: ApiDeps) {
  return new Hono()
    .get("/", async (c) => {
      await modify.ready().catch(() => undefined);
      return c.json(modify.state());
    })
    .post("/", validate("json", RequestBody), async (c) =>
      c.json(await modify.request(c.req.valid("json").request), 202),
    )
    .post("/keep", async (c) => c.json(await modify.keep()))
    .post("/undo", async (c) => c.json(await modify.undo()))
    .post("/discard", async (c) => c.json(await modify.discard()))
    .post("/update", async (c) => c.json(await modify.applyUpdate(), 202))
    .get("/history", async (c) => c.json({ versions: await modify.history() }))
    .post("/restore", validate("json", RestoreBody), async (c) =>
      c.json(await modify.restore(c.req.valid("json").commit)),
    );
}
