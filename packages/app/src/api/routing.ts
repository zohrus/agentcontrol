import type { SessionId } from "@agentcontrol/protocol";
import { z } from "zod";
import type { StoredSession } from "../store/index.ts";
import type { Link } from "../sync/index.ts";
import type { ApiDeps } from "./deps.ts";
import { ApiFailure } from "./errors.ts";

/** What routing reads: the store (which workspace owns a session) and the workspaces (their relays). */
export type Routing = Pick<ApiDeps, "store" | "workspaces">;

/** The optional `?workspace=<id>` of a request that is not about one session; the local one by default. */
export const WorkspaceQuery = z.object({ workspace: z.string().min(1).optional() });

/** The session with this id, from the app's store; throws 404 when no workspace has it. */
export function locateSession(deps: Routing, id: SessionId): StoredSession {
  const [session] = deps.store.findSessions(id);
  if (!session)
    throw new ApiFailure(404, { code: "session-not-found", message: `No session ${id}.` });
  return session;
}

/**
 * The one place that turns a workspace id into the relay that serves it. A workspace that was
 * removed or is not connected refuses with a plain-language reason: its sessions stay readable from
 * the store, but nothing can be sent to them.
 */
function linkForWorkspace(deps: Routing, workspaceId: string): Link {
  const info = deps.workspaces.info(workspaceId);
  if (!info) {
    throw new ApiFailure(404, {
      code: "workspace-not-found",
      message: `No workspace ${workspaceId}.`,
    });
  }
  if (info.state === "removed") {
    const message = `The workspace "${info.label}" was removed, so its sessions are read-only.`;
    throw new ApiFailure(409, { code: "workspace-removed", message });
  }
  const link = deps.workspaces.link(workspaceId);
  if (link) return link;
  const why = info.reason === undefined ? "" : ` ${info.reason}`;
  const message = `The workspace "${info.label}" is ${info.state}, so its sessions are read-only.${why}`;
  throw new ApiFailure(503, {
    code: "relay-unavailable",
    message,
    data: { workspaceId, state: info.state },
  });
}

/**
 * Where a request goes: the workspace of the given session (from the store), else the given
 * workspace, else the local one.
 */
export function routeRequest(
  deps: Routing,
  target: { sessionId?: SessionId; workspaceId?: string | undefined } = {},
): { workspaceId: string; link: Link } {
  const workspaceId =
    target.sessionId === undefined
      ? (target.workspaceId ?? deps.workspaces.localId)
      : locateSession(deps, target.sessionId).workspaceId;
  return { workspaceId, link: linkForWorkspace(deps, workspaceId) };
}
