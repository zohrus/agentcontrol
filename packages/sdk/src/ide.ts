import type { SessionId } from "@agentcontrol/protocol";
import { read } from "./api-error.ts";
import type { Api } from "./client-type.ts";

/** Whether a session's browser VS Code can be opened; `reason` says why not, in plain words. */
export type IdeAvailability = { available: true } | { available: false; reason: string };

/** The browser VS Code (code-server) of a session's workspace. */
export function ideApi(api: Api) {
  return {
    /**
     * Can the session's browser VS Code be opened now? Not when code-server is not installed on the
     * session's workspace, when the workspace is offline, or when the session was archived.
     */
    ideStatus: (id: SessionId): Promise<IdeAvailability> =>
      read(api.sessions[":id"].ide.$get({ param: { id } })),
    /**
     * Starts code-server on the session's workspace (on its worktree) and returns the address to
     * open in a new tab. The address is on another port than the app: it has no access to the
     * app's API, expires after an hour unused, and stops working when the session is archived.
     * Throws ApiError "ide-unavailable" (see `ideStatus`) when it cannot be opened.
     */
    openIde: async (id: SessionId): Promise<string> => {
      const { url } = await read(api.sessions[":id"].ide.$post({ param: { id } }));
      return url;
    },
  };
}
