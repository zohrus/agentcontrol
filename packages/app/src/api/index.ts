import { Hono } from "hono";
import type { ApiDeps } from "./deps.ts";
import { configRoutes } from "./config.ts";
import { reportFailure } from "./errors.ts";
import { fileRoutes } from "./files.ts";
import { modifyRoutes } from "./modify.ts";
import {
  sessionControlRoutes,
  sessionConversationRoutes,
  sessionStartRoute,
} from "./sessions-commands.ts";
import { sessionReadRoutes } from "./sessions-read.ts";
import { streamRoute } from "./stream.ts";
import { workspaceRoutes } from "./workspace.ts";
import { workspacesRoutes } from "./workspaces.ts";

export type { ApiDeps } from "./deps.ts";

/** The HTTP API, mounted under `/api` by the server. Its type feeds the SDK's typed client. */
export function createApi(deps: ApiDeps) {
  return new Hono()
    .onError(reportFailure)
    .route("/sessions", sessionReadRoutes(deps))
    .route("/sessions", sessionStartRoute(deps))
    .route("/sessions", sessionConversationRoutes(deps))
    .route("/sessions", sessionControlRoutes(deps))
    .route("/sessions", fileRoutes(deps))
    .route("/modify", modifyRoutes(deps))
    .route("/config", configRoutes(deps))
    .route("/workspaces", workspacesRoutes(deps))
    .route("/", workspaceRoutes(deps))
    .route("/", streamRoute(deps));
}

/** The shape of the API, for `hc<AppType>` in the SDK. */
export type AppType = ReturnType<typeof createApi>;
