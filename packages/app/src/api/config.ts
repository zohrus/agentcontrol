import {
  ConfigAgent,
  ConfigApplyParams,
  ConfigRollbackParams,
  RelayName as N,
  ScopedItem,
} from "@agentcontrol/protocol";
import { Hono } from "hono";
import { z } from "zod";
import type { ApiDeps } from "./deps.ts";
import { validate } from "./validate.ts";

const ItemsBody = z.object({ items: z.array(ScopedItem) });
/** Which agents to look at or write for (all of them when left out), and the repo to include. */
const TargetBody = z.object({
  agents: z.array(ConfigAgent).optional(),
  repoPath: z.string().optional(),
});

const withAllAgents = (body: z.infer<typeof TargetBody>) => ({
  agents: body.agents ?? [...ConfigAgent.options],
  repoPath: body.repoPath,
});

/** Harness configuration: the canonical items, and putting them into the agents' own files. */
export function configRoutes({ store, relay }: ApiDeps) {
  return new Hono()
    .get("/items", (c) => c.json({ items: store.listConfigItems() }))
    .put("/items", validate("json", ItemsBody), (c) => {
      store.replaceConfigItems(c.req.valid("json").items);
      return c.json({ items: store.listConfigItems() });
    })
    .post("/import", validate("json", TargetBody), async (c) =>
      c.json(await relay.call(N.configInspect, withAllAgents(c.req.valid("json")))),
    )
    .post("/plan", validate("json", TargetBody), async (c) =>
      c.json(
        await relay.call(N.configPlan, {
          ...withAllAgents(c.req.valid("json")),
          items: store.listConfigItems(),
        }),
      ),
    )
    .post("/apply", validate("json", ConfigApplyParams), async (c) =>
      c.json(await relay.call(N.configApply, c.req.valid("json"))),
    )
    .post("/rollback", validate("json", ConfigRollbackParams), async (c) =>
      c.json(await relay.call(N.configRollback, c.req.valid("json"))),
    )
    .get("/drift", async (c) => c.json(await relay.call(N.configDrift, {})));
}
