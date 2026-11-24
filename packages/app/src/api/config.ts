import {
  ConfigAgent,
  ConfigApplyParams,
  ConfigRollbackParams,
  RelayName as N,
  ScopedItem,
} from "@agentcontrol/protocol";
import { Hono } from "hono";
import { z } from "zod";
import type { Link } from "../sync/index.ts";
import type { ApiDeps } from "./deps.ts";
import { routeRequest } from "./routing.ts";
import { validate } from "./validate.ts";

const placeOf = ({ item, scope }: ScopedItem): string =>
  `${item.id}|${scope.scope}|${scope.repoPath ?? ""}`;

function isConsistent(entries: ScopedItem[]): boolean {
  const onePerPlace = new Set(entries.map(placeOf)).size === entries.length;
  const bodies = new Set(entries.map(({ item }) => `${item.id}|${JSON.stringify(item)}`));
  const ids = new Set(entries.map(({ item }) => item.id));
  return onePerPlace && bodies.size === ids.size;
}

const ItemsBody = z.object({
  items: z
    .array(ScopedItem)
    .refine(isConsistent, "an item id may appear once per scope and must be the same item in each"),
});
/** Which agents to look at or write for (all of them when left out), and the repo to include. */
const TargetBody = z.object({
  agents: z.array(ConfigAgent).optional(),
  repoPath: z.string().optional(),
  repoPaths: z.array(z.string()).optional(),
});

const withAllAgents = (body: z.infer<typeof TargetBody>) => ({
  agents: body.agents ?? [...ConfigAgent.options],
  repoPath: body.repoPath,
});

/** Harness configuration: the canonical items, and putting them into the agents' own files. */
export function configRoutes(deps: ApiDeps) {
  const { store } = deps;
  const relay = (): Link => routeRequest(deps).link;
  return new Hono()
    .get("/items", (c) => c.json({ items: store.listConfigItems() }))
    .put("/items", validate("json", ItemsBody), (c) => {
      store.replaceConfigItems(c.req.valid("json").items);
      return c.json({ items: store.listConfigItems() });
    })
    .post("/import", validate("json", TargetBody), async (c) =>
      c.json(await relay().call(N.configInspect, withAllAgents(c.req.valid("json")))),
    )
    .post("/plan", validate("json", TargetBody), async (c) =>
      c.json(
        await relay().call(N.configPlan, {
          ...withAllAgents(c.req.valid("json")),
          repoPaths: c.req.valid("json").repoPaths,
          items: store.listConfigItems(),
        }),
      ),
    )
    .post("/apply", validate("json", ConfigApplyParams), async (c) =>
      c.json(await relay().call(N.configApply, c.req.valid("json"))),
    )
    .post("/rollback", validate("json", ConfigRollbackParams), async (c) =>
      c.json(await relay().call(N.configRollback, c.req.valid("json"))),
    )
    .get("/drift", async (c) => c.json(await relay().call(N.configDrift, {})));
}
