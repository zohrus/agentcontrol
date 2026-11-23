import { RelayName as N, SessionId } from "@agentcontrol/protocol";
import { Hono } from "hono";
import { z } from "zod";
import type { PreviewRead, PreviewSource } from "../preview/index.ts";
import type { ApiDeps } from "./deps.ts";
import { ApiFailure, failureOf } from "./errors.ts";
import { routeRequest } from "./routing.ts";
import { validate } from "./validate.ts";

const IdParam = z.object({ id: SessionId });

/** The session's record unless it is missing or archived (then its worktree is gone). */
function isOpen(deps: ApiDeps, sessionId: SessionId): boolean {
  const { workspaceId } = routeRequest(deps);
  const session = deps.store.getSession({ workspaceId, sessionId });
  return session !== undefined && session.status !== "archived";
}

/** Where `/preview/<ticket>/...` reads files from: the relay, as raw bytes of the working copy. */
export function previewSource(deps: ApiDeps): PreviewSource {
  return {
    isOpen: (sessionId) => isOpen(deps, sessionId),
    read: async ({ sessionId, path }): Promise<PreviewRead> => {
      try {
        const { base64 } = await routeRequest(deps).link.call(N.fsReadBytes, { sessionId, path });
        return { bytes: Buffer.from(base64, "base64") };
      } catch (error) {
        const { status, error: body } = failureOf(error as Error);
        return { refused: { status, message: body.message } };
      }
    },
  };
}

/** Hands out the ticket a Preview iframe needs, to a caller that is itself authenticated. */
export function previewTicketRoutes(deps: ApiDeps) {
  return new Hono().post("/:id/preview", validate("param", IdParam), (c) => {
    const { id } = c.req.valid("param");
    if (!isOpen(deps, id)) {
      throw new ApiFailure(404, {
        code: "session-not-found",
        message: `No open session ${id}, so there is nothing to preview.`,
      });
    }
    return c.json({ ticket: deps.previews.ticketFor(id) });
  });
}
