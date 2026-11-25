import { join, resolve } from "node:path";
import { createBuildCache } from "./build-cache.ts";
import { createUiBuilds, type UiBuilds } from "./built-ui.ts";
import { serveUiWithVite } from "./dev.ts";
import { serveBuiltUi } from "./static.ts";
import type { UiHandler } from "./types.ts";

export type { UiBuilds } from "./built-ui.ts";
export type { UiHandler } from "./types.ts";

/**
 * Which UI to serve: a project folder run with Vite (`bun dev`), a folder of built files, or the
 * live UI folder of the data folder as a production build (a release); none by default.
 */
export interface UiSource {
  root?: string | undefined;
  dist?: string | undefined;
  production?: boolean | undefined;
}

/**
 * The UI's builds in a data folder: the live UI folder `ui` is built into `ui-build`, and the
 * default UI of this release (`templateDir`, with its `dist` folder built) saves the first build.
 */
export function createBuilds(options: {
  dataDir: string;
  templateDir: string;
  /** Part of what names a build: another release builds the same files again. */
  version: string;
}): UiBuilds {
  const { dataDir, templateDir, version } = options;
  const cache = createBuildCache({ root: join(dataDir, "ui-build"), salt: version });
  return createUiBuilds({
    cache,
    liveDir: resolve(dataDir, "ui"),
    prebuilt: { dir: join(templateDir, "dist"), template: join(dataDir, "ui-template") },
  });
}

/**
 * Starts serving the configured UI, or resolves with undefined when the app serves only its API.
 * `dataDir` is where the app keeps the process id of its UI server, so that a server left behind
 * by a run that was replaced in place (`bun --watch`) or killed is stopped by the next one.
 */
export async function startUi(
  source: UiSource,
  options: { dataDir: string; builds: UiBuilds },
): Promise<UiHandler | undefined> {
  const { dataDir, builds } = options;
  if (source.dist !== undefined) return serveBuiltUi(source.dist);
  if (source.production === true) return builds.serve();
  if (source.root === undefined) return undefined;
  return serveUiWithVite({ root: source.root, pidFile: join(dataDir, "ui-server.pid") });
}
