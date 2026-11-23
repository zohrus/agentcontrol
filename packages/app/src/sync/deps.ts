import type { Store, Workspace } from "../store/index.ts";
import type { Hub } from "./hub.ts";

/** What syncing one workspace's relay needs: where to save, whom to tell, and which workspace. */
export interface SyncDeps {
  store: Store;
  hub: Hub;
  workspace: Workspace;
}
