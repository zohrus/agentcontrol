import { RelayName as N, RepoId, RepoSetup, ReposAddParams } from "@agentcontrol/protocol";
import { Hono } from "hono";
import { z } from "zod";
import type { ApiDeps } from "./deps.ts";
import { validate } from "./validate.ts";

const RepoParam = z.object({ id: RepoId });

/** Repos, their worktree setup, and the workspace's health. */
export function workspaceRoutes({ relay }: ApiDeps) {
  return new Hono()
    .get("/repos", async (c) => c.json(await relay.call(N.reposList, {})))
    .post("/repos", validate("json", ReposAddParams), async (c) =>
      c.json(await relay.call(N.reposAdd, c.req.valid("json")), 201),
    )
    .put(
      "/repos/:id/setup",
      validate("param", RepoParam),
      validate("json", RepoSetup),
      async (c) => {
        await relay.call(N.reposSetSetup, {
          repoId: c.req.valid("param").id,
          setup: c.req.valid("json"),
        });
        return c.json({});
      },
    )
    .get("/workspace/check", async (c) => c.json(await relay.call(N.workspaceCheck, {})))
    .get("/agents", async (c) => {
      const { agents } = await relay.call(N.hello, { clientVersion: "0.0.0" });
      return c.json({ agents });
    })
    .get("/health", (c) => c.json({ ok: true }));
}
