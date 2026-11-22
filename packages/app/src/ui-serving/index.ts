import { serveUiWithVite } from "./dev.ts";
import { serveBuiltUi } from "./static.ts";
import type { UiHandler } from "./types.ts";

export type { UiHandler } from "./types.ts";

/** Which UI to serve: a project folder run with Vite, or a folder of built files; none by default. */
export interface UiSource {
  root?: string | undefined;
  dist?: string | undefined;
}

/** Starts serving the configured UI, or resolves with undefined when the app serves only its API. */
export async function startUi(source: UiSource): Promise<UiHandler | undefined> {
  if (source.dist !== undefined) return serveBuiltUi(source.dist);
  if (source.root !== undefined) return serveUiWithVite(source.root);
  return undefined;
}
