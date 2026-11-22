import { Hono } from "hono";
import type { ApiDeps } from "../api/index.ts";
import { createApi } from "../api/index.ts";
import type { UiHandler } from "../ui-serving/index.ts";

export interface RunningServer {
  /** The port actually bound (useful when 0 was asked for). */
  port: number;
  stop: () => Promise<void>;
}

/** Paths that are never the UI's: the API, and the reserved rollback page (not built yet). */
const notTheUi = ["/api/*", "/_safe", "/_safe/*"];

/**
 * The single place that decides what the app serves besides the API: the UI (Vite in dev, built
 * files otherwise) answers everything the API and the reserved paths do not.
 */
function createRoot(options: { deps: ApiDeps; ui: UiHandler | undefined }): Hono {
  const root = new Hono().route("/api", createApi(options.deps));
  const { ui } = options;
  if (ui === undefined) return root;
  for (const path of notTheUi) root.all(path, (c) => c.notFound());
  return root.get("*", (c) => ui.fetch(c.req.raw));
}

/** Serves the API, and the UI when one is given, on 127.0.0.1 only. */
export function startServer(options: {
  port: number;
  deps: ApiDeps;
  ui?: UiHandler | undefined;
}): RunningServer {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: options.port,
    idleTimeout: 0,
    fetch: createRoot({ deps: options.deps, ui: options.ui }).fetch,
  });
  return {
    port: server.port ?? options.port,
    stop: () => server.stop(true),
  };
}
