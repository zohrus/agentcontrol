import type { Modify } from "../modify/index.ts";
import type { Store, Workspace } from "../store/index.ts";
import type { Hub, Link } from "../sync/index.ts";

/** What the API needs from the rest of the app, handed in at the edge. */
export interface ApiDeps {
  store: Store;
  hub: Hub;
  /** The workspace the app is connected to, as recorded in the store. */
  workspace: Workspace;
  /** The relay link of `workspace`. Routes reach it only through `api/routing.ts`. */
  relay: Link;
  modify: Modify;
}
