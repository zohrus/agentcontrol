import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { onTestEnd } from "./cleanup.ts";
import { createLocalRepo } from "./local-repo.ts";
import { createMockAgent, type MockAgent } from "./mock-agent-script.ts";
import { actionsOf } from "./relay-actions.ts";
import { stopRelayDaemon } from "./relay-client.ts";
import type { RelayAccess, Session } from "./relay.ts";
import { type User, userOf } from "./relay-user.ts";

const mockAgentMain = join(import.meta.dir, "../mock-agent/main.ts");

/** A relay as the app sees it: connect and disconnect at will; the daemon keeps running. */
export interface RunningRelay extends RelayAccess {
  readonly user: User;
  /** Closes the app's connection; the relay and its sessions carry on without it. */
  closesTheApp(): Promise<void>;
  /** Connects again, as the app does on launch; nothing is followed until the app asks. */
  opensTheApp(): void;
  /** Stops the relay daemon and starts it again; sessions are read back from their logs. */
  restartsTheRelay(): Promise<void>;
  /** Follows one session on the current connection, receiving only events after `afterSeq`. */
  followsSessionAfter(session: Session, afterSeq: number): Promise<void>;
  /** Makes the repo's worktree setup run this script (it runs in each new session's worktree). */
  repoSetupScriptIs(script: string): Promise<void>;
}

function relayEnvironment(mockAgent: MockAgent): Record<string, string> {
  return {
    AGENTCONTROL_AGENT_MOCK_CMD: JSON.stringify(["bun", mockAgentMain]),
    MOCK_AGENT_SCRIPT: mockAgent.scriptPath,
  };
}

/** Starts a relay on a fresh data folder with a local git repo and the mock agent, then connects. */
export async function startRelayWithLocalRepo(): Promise<RunningRelay> {
  const dataDir = await mkdtemp(join(tmpdir(), "agentcontrol-relay-"));
  onTestEnd(() => rm(dataDir, { recursive: true, force: true }));
  const repoPath = await createLocalRepo();
  const mockAgent = await createMockAgent();
  onTestEnd(() => stopRelayDaemon(dataDir));
  const { follow, current, ...actions } = actionsOf({
    dataDir,
    repoPath,
    env: relayEnvironment(mockAgent),
  });
  const access: RelayAccess = {
    dataDir,
    repoPath,
    mockAgent,
    call: (method, params) => current().call(method, params),
    get events() {
      return current().events;
    },
    get fileChanges() {
      return current().fileChanges;
    },
  };
  await follow();
  return Object.assign(access, actions, { user: userOf(access) });
}
