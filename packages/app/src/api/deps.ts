import type { Store } from "../store/index.ts";
import type { Hub, Link } from "../sync/index.ts";

/** What the API needs from the rest of the app, handed in at the edge. */
export interface ApiDeps {
  store: Store;
  hub: Hub;
  relay: Link;
}
