import type { Modify } from "../modify/index.ts";
import type { Store } from "../store/index.ts";
import type { Hub } from "../sync/index.ts";
import type { Workspaces } from "../workspaces/index.ts";

/** What the API needs from the rest of the app, handed in at the edge. */
export interface ApiDeps {
  store: Store;
  hub: Hub;
  /** The machines the app runs on. Routes reach their relays only through `api/routing.ts`. */
  workspaces: Workspaces;
  modify: Modify;
}
