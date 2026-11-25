import type { Modify } from "./modify/index.ts";
import type { Store } from "./store/index.ts";
import type { UiBuilds, UiHandler } from "./ui-serving/index.ts";
import type { Workspaces } from "./workspaces/index.ts";

/** Ends what a started app holds, in order: the Modify agent's session first, the database last. */
export async function closeParts(parts: {
  modify: Modify;
  builds: UiBuilds;
  ui: UiHandler | undefined;
  workspaces: Workspaces;
  store: Store;
}): Promise<void> {
  await parts.modify.stop();
  parts.builds.stop();
  await parts.ui?.close();
  await parts.workspaces.stop();
  parts.store.close();
}
