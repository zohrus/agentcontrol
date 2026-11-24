import type { RelayClient } from "../relays/index.ts";
import type { Store, Workspace } from "../store/index.ts";
import type { Hub } from "./hub.ts";

/**
 * What to do about a relay of another version or build than the app: replace it (the answer says so) or say
 * why it stays, in which case it is used as it is and the workspace needs a relay update.
 */
export type ReplaceRelay = (options: {
  client: RelayClient;
  /** How the relay differs from the app, as `relayMismatch` words it. */
  mismatch: string;
}) => Promise<{ replaced: boolean; reason: string }>;

/** What syncing one workspace's relay needs: where to save, whom to tell, and which workspace. */
export interface SyncDeps {
  store: Store;
  hub: Hub;
  workspace: Workspace;
  /** Asked once per connection when the relay is not the app's own. */
  replaceRelay?: ReplaceRelay | undefined;
}
