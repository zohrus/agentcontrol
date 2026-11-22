import { Hono } from "hono";
import type { ApiDeps } from "../api/index.ts";
import { createApi } from "../api/index.ts";

export interface RunningServer {
  /** The port actually bound (useful when 0 was asked for). */
  port: number;
  stop: () => Promise<void>;
}

/**
 * The single place that decides what the app serves besides the API.
 * Mount the UI here (Vite in dev, the built files in release) on the returned app.
 */
function createRoot(deps: ApiDeps): Hono {
  return new Hono().route("/api", createApi(deps));
}

/** Serves the API on 127.0.0.1 only. */
export function startServer(options: { port: number; deps: ApiDeps }): RunningServer {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: options.port,
    idleTimeout: 0,
    fetch: createRoot(options.deps).fetch,
  });
  return {
    port: server.port ?? options.port,
    stop: () => server.stop(true),
  };
}
