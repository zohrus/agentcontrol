import { RelayName as N, VERSION } from "@agentcontrol/protocol";
import { availableAgents, type HostEnv } from "../agents/index.ts";
import { checkWorkspace, type RepoStore } from "../repos/index.ts";
import type { Handlers } from "../rpc/index.ts";

/** The version this relay reports. AGENTCONTROL_RELAY_VERSION overrides it; only tests set it. */
const versionIn = (env: HostEnv): string => env["AGENTCONTROL_RELAY_VERSION"] ?? VERSION;

type WorkspaceMethods =
  | typeof N.hello
  | typeof N.workspaceCheck
  | typeof N.reposAdd
  | typeof N.reposList
  | typeof N.reposSetSetup;

/** The methods about the machine itself: hello, setup checklist, registered repos. */
export function workspaceHandlers(
  repos: RepoStore,
  env: HostEnv,
): Pick<Handlers, WorkspaceMethods> {
  return {
    [N.hello]: () =>
      Promise.resolve({ relayVersion: versionIn(env), agents: availableAgents(env) }),
    [N.workspaceCheck]: ({ agents }) => checkWorkspace(env, { withAgents: agents }),
    [N.reposAdd]: async ({ path }) => {
      const { repoId, defaultBranch, path: root } = await repos.add(path);
      return { repoId, defaultBranch, path: root };
    },
    [N.reposList]: async () => ({ repos: await repos.list() }),
    [N.reposSetSetup]: async ({ repoId, setup }) => {
      await repos.setSetup(repoId, setup);
      return {};
    },
  };
}
