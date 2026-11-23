import { RelayName as N, RepoId, RepoSetup, ReposAddParams, VERSION } from "@agentcontrol/protocol";
import { Hono } from "hono";
import { z } from "zod";
import type { Link } from "../sync/index.ts";
import type { ApiDeps } from "./deps.ts";
import { ApiFailure } from "./errors.ts";
import { routeRequest, WorkspaceQuery } from "./routing.ts";
import { validate } from "./validate.ts";

const RepoParam = z.object({ id: RepoId });
const query = validate("query", WorkspaceQuery);

/** Repos and their worktree setup. Each takes `?workspace=<id>`; the local workspace when left out. */
function repoRoutes(relay: (workspace: string | undefined) => Link) {
  return new Hono()
    .get("/repos", query, async (c) =>
      c.json(await relay(c.req.valid("query").workspace).call(N.reposList, {})),
    )
    .post("/repos", query, validate("json", ReposAddParams), async (c) =>
      c.json(
        await relay(c.req.valid("query").workspace).call(N.reposAdd, c.req.valid("json")),
        201,
      ),
    )
    .put(
      "/repos/:id/setup",
      query,
      validate("param", RepoParam),
      validate("json", RepoSetup),
      async (c) => {
        const setup = c.req.valid("json");
        const repoId = c.req.valid("param").id;
        await relay(c.req.valid("query").workspace).call(N.reposSetSetup, { repoId, setup });
        return c.json({});
      },
    );
}

/** One workspace with its connection state: answers even while its relay is down. */
function describe(deps: ApiDeps, workspace: string | undefined) {
  const id = workspace ?? deps.workspaces.localId;
  const info = deps.workspaces.info(id);
  if (!info)
    throw new ApiFailure(404, { code: "workspace-not-found", message: `No workspace ${id}.` });
  return info;
}

/** Repos, their worktree setup, and the workspace's health, per `?workspace=<id>`. */
export function workspaceRoutes(deps: ApiDeps) {
  const relay = (workspace: string | undefined): Link =>
    routeRequest(deps, { workspaceId: workspace }).link;
  return new Hono()
    .route("/", repoRoutes(relay))
    .get("/workspace", query, (c) => c.json(describe(deps, c.req.valid("query").workspace)))
    .get("/workspace/check", query, async (c) =>
      c.json(await relay(c.req.valid("query").workspace).call(N.workspaceCheck, {})),
    )
    .get("/agents", query, async (c) => {
      const link = relay(c.req.valid("query").workspace);
      const { agents } = await link.call(N.hello, { clientVersion: VERSION });
      return c.json({ agents });
    })
    .get("/health", query, (c) => {
      const { state } = describe(deps, c.req.valid("query").workspace);
      const answers = state === "connected" || state === "needs-relay-update";
      return c.json({ ok: true, relay: answers ? "connected" : "disconnected" });
    });
}
