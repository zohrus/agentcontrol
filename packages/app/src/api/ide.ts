import { RelayName as N, SessionId } from "@agentcontrol/protocol";
import { Hono } from "hono";
import { z } from "zod";
import type { IdeSource } from "../ide/index.ts";
import type { ApiDeps } from "./deps.ts";
import { ApiFailure } from "./errors.ts";
import { locateSession, routeRequest } from "./routing.ts";
import { validate } from "./validate.ts";

const IdParam = z.object({ id: SessionId });

/** Where the IDE's origin reads sessions and relays from: the store and the workspaces. */
export function ideSource(deps: Pick<ApiDeps, "store" | "workspaces">): IdeSource {
  return {
    isOpen: (sessionId) => {
      const [session] = deps.store.findSessions(sessionId);
      return session !== undefined && session.status !== "archived";
    },
    linkOf: (sessionId) => routeRequest(deps, { sessionId }).link,
  };
}

const ARCHIVED = "This session was archived: it has no folder to open in VS Code.";

/** The refusal's message when the workspace cannot be reached; any other failure is a real one. */
function refusalMessage(error: unknown): string {
  if (error instanceof ApiFailure) return error.error.message;
  throw error;
}

async function missingCodeServer(deps: ApiDeps, sessionId: SessionId): Promise<string | undefined> {
  const { link, workspaceId } = routeRequest(deps, { sessionId });
  const status = await link.call(N.ideStatus, { sessionId });
  if (status.installed) return undefined;
  const label = deps.workspaces.info(workspaceId)?.label ?? "this workspace";
  const hint = "curl -fsSL https://code-server.dev/install.sh | sh";
  return `code-server is not installed on ${label}. Install it there with: ${hint}`;
}

/** Why the browser VS Code cannot be opened for the session right now, or undefined when it can. */
async function unavailableReason(deps: ApiDeps, sessionId: SessionId): Promise<string | undefined> {
  if (locateSession(deps, sessionId).status === "archived") return ARCHIVED;
  return missingCodeServer(deps, sessionId).catch(refusalMessage);
}

/** The browser VS Code of a session: can it be opened, and the address that opens it. */
export function ideRoutes(deps: ApiDeps) {
  return new Hono()
    .get("/:id/ide", validate("param", IdParam), async (c) => {
      const { id } = c.req.valid("param");
      const reason = await unavailableReason(deps, id);
      return c.json(reason === undefined ? { available: true } : { available: false, reason });
    })
    .post("/:id/ide", validate("param", IdParam), async (c) => {
      const { id } = c.req.valid("param");
      const reason = await unavailableReason(deps, id);
      if (reason !== undefined) {
        throw new ApiFailure(409, { code: "ide-unavailable", message: reason });
      }
      await routeRequest(deps, { sessionId: id }).link.call(N.ideStart, { sessionId: id });
      return c.json({ url: `${deps.ide.origin()}/${deps.ide.tickets.ticketFor(id)}/` });
    });
}
