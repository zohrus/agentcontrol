import { RelayName as N, RepoId, RepoSetup, ReposAddParams, VERSION } from "@agentcontrol/protocol";
import { Hono } from "hono";
import { z } from "zod";
import type { Link } from "../sync/index.ts";
import type { ApiDeps } from "./deps.ts";
import { routeRequest } from "./routing.ts";
import { validate } from "./validate.ts";

const RepoParam = z.object({ id: RepoId });

/** The workspace the app serves, with whether its relay is connected. */
function describeWorkspace(deps: ApiDeps) {
  const { workspaceId, link } = routeRequest(deps);
  const { label, kind } = deps.workspace;
  const { state, relayVersion } = link.connection();
  return {
    ...{ id: workspaceId, label, kind, appVersion: VERSION },
    connection: state,
    ...(relayVersion === undefined ? {} : { relayVersion }),
  };
}

/** Repos, their worktree setup, and the workspace's health. */
export function workspaceRoutes(deps: ApiDeps) {
  const relay = (): Link => routeRequest(deps).link;
  return new Hono()
    .get("/repos", async (c) => c.json(await relay().call(N.reposList, {})))
    .post("/repos", validate("json", ReposAddParams), async (c) =>
      c.json(await relay().call(N.reposAdd, c.req.valid("json")), 201),
    )
    .put(
      "/repos/:id/setup",
      validate("param", RepoParam),
      validate("json", RepoSetup),
      async (c) => {
        await relay().call(N.reposSetSetup, {
          repoId: c.req.valid("param").id,
          setup: c.req.valid("json"),
        });
        return c.json({});
      },
    )
    .get("/workspace", (c) => c.json(describeWorkspace(deps)))
    .get("/workspace/check", async (c) => c.json(await relay().call(N.workspaceCheck, {})))
    .get("/agents", async (c) => {
      const { agents } = await relay().call(N.hello, { clientVersion: VERSION });
      return c.json({ agents });
    })
    .get("/health", (c) => c.json({ ok: true, relay: relay().connection().state }));
}
