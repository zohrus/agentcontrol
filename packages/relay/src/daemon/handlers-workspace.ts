import { RelayName as N } from "@agentcontrol/protocol";
import { availableAgents, type HostEnv } from "../agents/index.ts";
import { checkWorkspace, type RepoStore } from "../repos/index.ts";
import type { Handlers } from "../rpc/index.ts";

const RELAY_VERSION = "0.0.0";

type WorkspaceMethods =
  | typeof N.hello
  | typeof N.workspaceCheck
  | typeof N.reposAdd
  | typeof N.reposList
  | typeof N.reposSetSetup;

/** The methods about the machine itself: hello, setup checklist, registered repos. */
export function workspaceHandlers(call: {
  repos: RepoStore;
  env: HostEnv;
  normaliserVersion: number;
}): Pick<Handlers, WorkspaceMethods> {
  const { repos, env, normaliserVersion } = call;
  return {
    [N.hello]: () =>
      Promise.resolve({
        relayVersion: RELAY_VERSION,
        normaliserVersion,
        agents: availableAgents(env),
      }),
    [N.workspaceCheck]: () => checkWorkspace(env),
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
