import type { WorkspaceInfo } from "@agentcontrol/protocol";
import { Hono } from "hono";
import { z } from "zod";
import { isSafeHost } from "../relays/index.ts";
import type { ApiDeps } from "./deps.ts";
import { ApiFailure } from "./errors.ts";
import { validate } from "./validate.ts";

const IdParam = z.object({ id: z.string().min(1) });
const AddBody = z.object({
  kind: z.literal("ssh"),
  host: z.string().refine(isSafeHost, "a host name or alias, or user@host"),
  label: z.string().min(1).optional(),
});

/** The workspace an action is about; it must exist and not be removed. */
function activeWorkspace(deps: ApiDeps, id: string): WorkspaceInfo {
  const info = deps.workspaces.info(id);
  if (!info) {
    throw new ApiFailure(404, { code: "workspace-not-found", message: `No workspace ${id}.` });
  }
  if (info.state === "removed") {
    const message = `"${info.label}" was removed.`;
    throw new ApiFailure(409, { code: "workspace-removed", message });
  }
  return info;
}

/** Like `activeWorkspace`, and it must be an ssh one: this Mac cannot be removed or restarted. */
function activeSshWorkspace(deps: ApiDeps, id: string): WorkspaceInfo {
  const info = activeWorkspace(deps, id);
  if (info.kind === "local") {
    const message = "This Mac is always a workspace; it cannot be removed or restarted from here.";
    throw new ApiFailure(409, { code: "local-workspace", message });
  }
  return info;
}

function refuseKnownHost(deps: ApiDeps, host: string): void {
  const known = deps.workspaces
    .list()
    .find((info) => info.sshHost === host && info.state !== "removed");
  if (known) {
    const message = `"${host}" is already a workspace ("${known.label}").`;
    throw new ApiFailure(409, { code: "workspace-exists", message });
  }
}

/** The machines the app runs on: list them, add an ssh host, check, restart the relay, remove. */
export function workspacesRoutes(deps: ApiDeps) {
  const { workspaces } = deps;
  return new Hono()
    .get("/", (c) => c.json({ workspaces: workspaces.list() }))
    .get("/hosts", async (c) => c.json({ hosts: await workspaces.hosts() }))
    .post("/", validate("json", AddBody), async (c) => {
      const { host, label } = c.req.valid("json");
      refuseKnownHost(deps, host);
      return c.json(await workspaces.addSsh({ host, label }), 201);
    })
    .post("/:id/check", validate("param", IdParam), async (c) => {
      const { id } = activeWorkspace(deps, c.req.valid("param").id);
      return c.json({ steps: await workspaces.check(id) });
    })
    .post("/:id/restart-relay", validate("param", IdParam), async (c) => {
      const { id } = activeSshWorkspace(deps, c.req.valid("param").id);
      return c.json(await workspaces.restartRelay(id));
    })
    .delete("/:id", validate("param", IdParam), async (c) => {
      const { id } = activeSshWorkspace(deps, c.req.valid("param").id);
      return c.json(await workspaces.remove(id));
    });
}
