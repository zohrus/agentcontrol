import type { CheckStep, WorkspaceInfo } from "@agentcontrol/protocol";
import { read } from "./api-error.ts";
import type { Api } from "./client-type.ts";

/** What to add as a workspace: an ssh host. */
export interface AddWorkspace {
  kind: "ssh";
  /** A host alias from `workspaces.hosts()` (~/.ssh/config), or `host` or `user@host`. */
  host: string;
  /** The name shown in the UI; defaults to the host. */
  label?: string;
  /**
   * Names this request on the live stream's `onWorkspaceProgress` messages, so the caller can show
   * each step as it happens. Any text that is unlikely to be used by another request.
   */
  requestId?: string;
}

function workspaceReads(api: Api) {
  return {
    /** Every workspace, removed ones included (state "removed"), "This Mac" first. */
    list: async (): Promise<WorkspaceInfo[]> => {
      const { workspaces } = await read(api.workspaces.$get());
      return workspaces;
    },
    /** Host aliases from the user's ~/.ssh/config (no wildcards), to pick from when adding. */
    hosts: async (): Promise<string[]> => {
      const { hosts } = await read(api.workspaces.hosts.$get());
      return hosts;
    },
  };
}

function workspaceChanges(api: Api) {
  return {
    /**
     * Adds an ssh workspace: connects, and installs the relay on the host when needed. With
     * `requestId` each step (connect, platform, install, relay) is pushed as it happens
     * (`onWorkspaceProgress`). Resolves once
     * the first attempt has finished, so the returned workspace is `connected`, or `offline` with a
     * `reason`. Throws ApiError "invalid-request" for a malformed host, "workspace-exists" for a host
     * that is already a workspace.
     */
    add: (workspace: AddWorkspace): Promise<WorkspaceInfo> =>
      read(api.workspaces.$post({ json: workspace })),
    /**
     * Disconnects and removes a workspace. Its past sessions stay readable. The host is left as it
     * is: the relay keeps running there. Throws ApiError "local-workspace" for "This Mac".
     */
    remove: (id: string): Promise<WorkspaceInfo> =>
      read(api.workspaces[":id"].$delete({ param: { id } })),
  };
}

function workspaceRepairs(api: Api) {
  return {
    /**
     * The "Add workspace / Check and repair" checklist, run now: connect, platform, relay installed,
     * relay running, then the relay's own steps (os, disk, git, gitIdentity, one `agent-<kind>`
     * handshake step per agent) and `repos`. Steps after a failed one are "skipped". It also installs
     * a missing relay, which is the repair. With `requestId` each step is also pushed as it happens
     * (`onWorkspaceProgress`).
     */
    check: async (id: string, options: { requestId?: string } = {}): Promise<CheckStep[]> => {
      const query = options.requestId === undefined ? {} : { requestId: options.requestId };
      const { steps } = await read(api.workspaces[":id"].check.$post({ param: { id }, query }));
      return steps;
    },
    /**
     * Stops the relay on the machine (its running agents end) and connects again, which starts the
     * app's own relay. For a workspace in state "needs-relay-update" when the user does not want to
     * wait for its sessions to finish. This Mac too.
     */
    restartRelay: (id: string): Promise<WorkspaceInfo> =>
      read(api.workspaces[":id"]["restart-relay"].$post({ param: { id } })),
  };
}

/**
 * The machines agents run on. "This Mac" always exists (id "local"); ssh workspaces are added by
 * the user. Every workspace has a connection `state` (see `WorkspaceInfo`), pushed live through
 * `subscribe({ onWorkspace })`. Sessions of a workspace that is not connected, or was removed, stay
 * listed and readable; commands on them fail with ApiError "relay-unavailable" (not connected) or
 * "workspace-removed", whose message says why in plain words.
 */
export function workspacesApi(api: Api) {
  return { ...workspaceReads(api), ...workspaceChanges(api), ...workspaceRepairs(api) };
}
