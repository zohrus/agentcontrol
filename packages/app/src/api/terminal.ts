import { SessionId } from "@agentcontrol/protocol";
import type { Server } from "bun";
import { Hono } from "hono";
import { z } from "zod";
import { type TerminalSocketData, upgradeToTerminal } from "../terminal/index.ts";
import type { ApiDeps } from "./deps.ts";
import { ApiFailure } from "./errors.ts";
import { locateSession, routeRequest } from "./routing.ts";
import { validate } from "./validate.ts";

const IdParam = z.object({ id: SessionId });

/**
 * `GET /sessions/:id/terminal`, a WebSocket upgrade. By the time it runs the root guard has checked
 * Host, Origin and the secret (a browser sends the secret as a WebSocket subprotocol, since it
 * cannot set headers). Anything that is not an upgrade, or cannot get a shell, is refused here, so
 * a socket exists only for a session that is open on a connected workspace.
 */
export function terminalRoutes(deps: ApiDeps) {
  return new Hono<{ Bindings: Server<TerminalSocketData> }>().get(
    "/:id/terminal",
    validate("param", IdParam),
    (c) => {
      const { id: sessionId } = c.req.valid("param");
      if (c.req.header("upgrade")?.toLowerCase() !== "websocket") {
        throw new ApiFailure(426, {
          code: "upgrade-required",
          message: "The terminal is a WebSocket: connect with `new WebSocket`.",
        });
      }
      if (locateSession(deps, sessionId).status === "archived") {
        throw new ApiFailure(409, {
          code: "session-archived",
          message: "This session was archived: it has no folder to open a terminal in.",
        });
      }
      const { link } = routeRequest(deps, { sessionId });
      const data = { link, sessionId };
      if (!upgradeToTerminal({ server: c.env, request: c.req.raw, data })) {
        throw new ApiFailure(400, { code: "invalid-request", message: "Not a WebSocket request." });
      }
      return new Response(null);
    },
  );
}
