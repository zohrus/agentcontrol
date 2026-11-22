import type { Link } from "../sync/index.ts";
import type { ApiDeps } from "./deps.ts";
import { ApiFailure } from "./errors.ts";

/**
 * PHASE 5 SEAM: the one place that turns a workspace id into the relay that serves it. The app
 * runs a single relay link today, so only the workspace it serves is known; phase 5 replaces this
 * body with a lookup in a registry of links, and no route changes.
 */
export function linkForWorkspace(deps: ApiDeps, workspaceId: string): Link {
  if (workspaceId !== deps.workspace.id) {
    throw new ApiFailure(404, {
      code: "workspace-not-found",
      message: `No workspace ${workspaceId}.`,
    });
  }
  return deps.relay;
}

/**
 * Where a request goes. URLs carry no workspace yet, so it is the workspace the app serves; phase 5
 * takes a session's workspace from the store (or a `?workspace=` query) here, in this one function.
 */
export function routeRequest(deps: ApiDeps): { workspaceId: string; link: Link } {
  const workspaceId = deps.workspace.id;
  return { workspaceId, link: linkForWorkspace(deps, workspaceId) };
}
