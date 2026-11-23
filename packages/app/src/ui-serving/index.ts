import { join } from "node:path";
import { serveUiWithVite } from "./dev.ts";
import { serveBuiltUi } from "./static.ts";
import type { UiHandler } from "./types.ts";

export type { UiHandler } from "./types.ts";

/** Which UI to serve: a project folder run with Vite, or a folder of built files; none by default. */
export interface UiSource {
  root?: string | undefined;
  dist?: string | undefined;
}

/**
 * Starts serving the configured UI, or resolves with undefined when the app serves only its API.
 * `dataDir` is where the app keeps the process id of its UI server, so that a server left behind
 * by a run that was replaced in place (`bun --watch`) or killed is stopped by the next one.
 */
export async function startUi(source: UiSource, dataDir: string): Promise<UiHandler | undefined> {
  if (source.dist !== undefined) return serveBuiltUi(source.dist);
  if (source.root === undefined) return undefined;
  return serveUiWithVite({ root: source.root, pidFile: join(dataDir, "ui-server.pid") });
}
