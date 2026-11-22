import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { onTestEnd } from "./cleanup.ts";
import { type RunningApp, startAppWithLocalWorkspace } from "./start-app.ts";

export const BUILT_UI_MARKER = "Built UI page";

/** A folder like a UI build: an index.html and one script, removed when the test ends. */
async function createBuiltUiFolder(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "agentcontrol-ui-"));
  onTestEnd(() => rm(folder, { recursive: true, force: true }));
  await Bun.write(join(folder, "index.html"), `<!doctype html><title>${BUILT_UI_MARKER}</title>`);
  await Bun.write(join(folder, "app.js"), "console.log('app');");
  return folder;
}

/** The app running and serving a folder of built UI files. */
export async function startsAppServingBuiltUi(): Promise<RunningApp> {
  return startAppWithLocalWorkspace({ uiDist: await createBuiltUiFolder() });
}
