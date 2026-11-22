import { resolve } from "node:path";
import type { UiHandler } from "./types.ts";

/** The UI template's server-side helper; it holds Vite, which the app does not depend on itself. */
const uiTemplateServer = new URL("../../../ui-template/server.ts", import.meta.url).href;

interface UiTemplateServer {
  createUiDevServer: (options: { root: string }) => Promise<UiHandler>;
}

/** Serves the UI project in `root` with Vite's dev server, so edits appear without a reload. */
export async function serveUiWithVite(root: string): Promise<UiHandler> {
  // Loaded by variable so a compiled app binary does not try to bundle Vite.
  const helper = (await import(uiTemplateServer)) as UiTemplateServer;
  return helper.createUiDevServer({ root: resolve(root) });
}
