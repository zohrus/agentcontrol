import type { Hub } from "../sync/index.ts";
import { checkThroughRelay } from "./check.ts";
import { reporterFor } from "./progress.ts";
import type { Entry } from "./registry.ts";
import type { Workspaces } from "./types.ts";

type Operations = Pick<Workspaces, "check" | "restartRelay">;

/**
 * What can be done to a workspace's relay, where this Mac is not like a host: its checklist is the
 * relay's own steps, and its relay is stopped by the app's own command, not over ssh. Every other
 * workspace goes to `remote`.
 */
export function operationsOf(call: {
  local: Entry;
  hub: Hub;
  list: Workspaces["list"];
  stopLocalRelay: (() => Promise<void>) | undefined;
  remote: Operations;
}): Operations {
  const { local, remote } = call;
  const localId = local.workspace.id;
  return {
    check: (id, options) => {
      if (id !== localId) return remote.check(id, options);
      const report = reporterFor({ hub: call.hub, requestId: options?.requestId, workspaceId: id });
      return checkThroughRelay(local.sync, report);
    },
    restartRelay: async (id) => {
      if (id !== localId) return remote.restartRelay(id);
      if (call.stopLocalRelay === undefined)
        throw new Error("This app cannot stop the relay here.");
      await call.stopLocalRelay();
      local.sync.retryNow();
      const info = call.list().find((known) => known.id === id);
      if (info === undefined) throw new Error("This Mac has no workspace.");
      return info;
    },
  };
}
