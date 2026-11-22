import type { Server } from "bun";
import { Hono } from "hono";
import type { ApiDeps } from "../api/index.ts";
import { createApi } from "../api/index.ts";
import { safeRoutes } from "../safe/index.ts";
import { type GuardOptions, guard, writeTokenFile } from "../security/index.ts";
import type { UiHandler } from "../ui-serving/index.ts";

export interface RunningServer {
  /** The port actually bound (useful when 0 was asked for). */
  port: number;
  stop: () => Promise<void>;
}

/** Paths that are never the UI's: the API, and the rollback page the app serves itself. */
const notTheUi = ["/api/*", "/_safe", "/_safe/*"];

/**
 * The single place that decides what the app serves besides the API: the UI (Vite in dev, built
 * files otherwise) answers everything the API and the reserved paths do not.
 */
function createRoot(options: {
  deps: ApiDeps;
  ui: UiHandler | undefined;
  guarded: GuardOptions;
}): Hono {
  const root = new Hono()
    .use(guard(options.guarded))
    .route("/api", createApi(options.deps))
    .route("/_safe", safeRoutes(options.deps.modify));
  const { ui } = options;
  if (ui === undefined) return root.get("/", (c) => c.html(fallbackPage));
  for (const path of notTheUi) root.all(path, (c) => c.notFound());
  return root.get("*", (c) => ui.fetch(c.req.raw));
}

const fallbackPage =
  "<!doctype html><html><head><title>AgentControl</title></head><body><p>AgentControl is running.</p></body></html>";

/**
 * Saves the secret right after binding: this runs in the same turn as `Bun.serve`, so no request
 * is handled before the file holds the new secret, and a start that cannot bind never touches it.
 */
function saveTokenOrStop(options: {
  server: Server<undefined>;
  dataDir: string;
  token: string;
}): void {
  try {
    writeTokenFile({ dataDir: options.dataDir, token: options.token });
  } catch (error) {
    void options.server.stop(true);
    throw error;
  }
}

/** Serves the API, and the UI when one is given, on 127.0.0.1 only. */
export function startServer(options: {
  port: number;
  deps: ApiDeps;
  ui?: UiHandler | undefined;
  /** The secret every API request must carry (see `security/`). */
  token: string;
  /** Where the secret is saved for local programs, once the port is bound and before serving. */
  dataDir: string;
}): RunningServer {
  const guarded = { token: options.token, port: () => server.port ?? options.port };
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: options.port,
    idleTimeout: 0,
    fetch: createRoot({ deps: options.deps, ui: options.ui, guarded }).fetch,
  });
  saveTokenOrStop({ server, dataDir: options.dataDir, token: options.token });
  return {
    port: server.port ?? options.port,
    stop: () => server.stop(true),
  };
}
