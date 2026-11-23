import type { ApiDeps } from "./api/index.ts";
import { ideSource } from "./api/index.ts";
import { type IdeOrigin, startIdeOrigin } from "./ide/index.ts";
import { createPreviews } from "./preview/index.ts";

/**
 * Starts the browser VS Code's own listener (another port, so another origin than the app's) and
 * the API's view of it. Its links last as long as preview links: `lifetimeMs`, an hour by default.
 */
export function startIde(options: {
  lifetimeMs: number | undefined;
  parts: Pick<ApiDeps, "store" | "workspaces">;
}): { origin: IdeOrigin; ide: ApiDeps["ide"] } {
  const { lifetimeMs, parts } = options;
  const tickets = createPreviews(lifetimeMs === undefined ? {} : { lifetimeMs });
  const origin = startIdeOrigin({ tickets, source: ideSource(parts) });
  return { origin, ide: { tickets, origin: () => `http://127.0.0.1:${String(origin.port)}` } };
}
