import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { onTestEnd } from "./cleanup.ts";
import { createLocalRepo } from "./local-repo.ts";
import { createMockAgent, type MockAgent } from "./mock-agent-script.ts";
import { actionsOf } from "./relay-actions.ts";
import { connectToRelay, type RelayClient } from "./relay-client.ts";
import { type RelayHost, startRelayHost } from "./relay-host.ts";
import type { RelayAccess, Session } from "./relay.ts";
import { type User, userOf } from "./relay-user.ts";

const mockAgentMain = join(import.meta.dir, "../mock-agent/main.ts");

/** A relay as the app sees it: connect and disconnect at will; the daemon keeps running. */
export interface RunningRelay extends RelayAccess {
  readonly user: User;
  /** Another client of the same relay, connected as a second program would. */
  connectsAnotherClient(): RelayClient;
  /** Closes the app's connection; the relay and its sessions carry on without it. */
  closesTheApp(): Promise<void>;
  /** Connects again, as the app does on launch; nothing is followed until the app asks. */
  opensTheApp(): void;
  /** Stops the relay daemon and starts it again; sessions are read back from their logs. */
  restartsTheRelay(options?: { whileDown?: () => Promise<void> }): Promise<void>;
  /** Stops the relay daemon without first disconnecting the app, which stays connected to it. */
  stopsTheRelayWhileTheAppIsConnected(): Promise<void>;
  /** Starts the relay daemon again and opens a new connection for the app. */
  startsTheRelayAndConnectsTheApp(): Promise<void>;
  /** Follows one session on the current connection, receiving only events after `afterSeq`. */
  followsSessionAfter(session: Session, afterSeq: number): Promise<void>;
  /** Makes the repo's worktree setup run this script (it runs in each new session's worktree). */
  repoSetupScriptIs(script: string): Promise<void>;
}

function relayEnvironment(mockAgent: MockAgent, extra: Record<string, string>) {
  return {
    ...extra,
    AGENTCONTROL_AGENT_MOCK_CMD: JSON.stringify(["bun", mockAgentMain]),
    MOCK_AGENT_SCRIPT: mockAgent.scriptPath,
  };
}

/** What helpers may use of the relay, always over the app's current connection. */
function accessOver(
  home: { dataDir: string; repoPath: string; mockAgent: MockAgent },
  current: () => RelayClient,
): RelayAccess {
  return {
    ...home,
    call: (method, params) => current().call(method, params),
    request: (method, params) => current().request(method, params),
    sendLine: (line) => {
      current().sendLine(line);
    },
    get unansweredErrors() {
      return current().unansweredErrors;
    },
    get events() {
      return current().events;
    },
    get fileChanges() {
      return current().fileChanges;
    },
  };
}

/** Starts a relay on a fresh data folder with a local git repo and the mock agent, then connects. */
export async function startRelayWithLocalRepo(
  options: { env?: Record<string, string>; beforeShellStarts?: () => Promise<void> } = {},
): Promise<RunningRelay> {
  const dataDir = await mkdtemp(join(tmpdir(), "agentcontrol-relay-"));
  onTestEnd(() => rm(dataDir, { recursive: true, force: true }));
  const repoPath = await createLocalRepo();
  const mockAgent = await createMockAgent();
  const env = relayEnvironment(mockAgent, options.env ?? {});
  const host: RelayHost = await startRelayHost({
    dataDir,
    env,
    ...(options.beforeShellStarts && { beforeShellStarts: options.beforeShellStarts }),
  });
  onTestEnd(() => host.stop());
  const { follow, current, ...actions } = actionsOf({ host, repoPath });
  const access = accessOver({ dataDir, repoPath, mockAgent }, current);
  await follow();
  const connectsAnotherClient = (): RelayClient => connectToRelay(host.wire());
  return Object.assign(access, actions, { connectsAnotherClient, user: userOf(access) });
}
