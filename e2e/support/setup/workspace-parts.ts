import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { onTestEnd } from "./cleanup.ts";
import { createLocalRepo } from "./local-repo.ts";
import { createMockAgent, type MockAgent } from "./mock-agent-script.ts";
import { startRelayHost } from "./relay-host.ts";

const mockAgentMain = join(import.meta.dir, "../mock-agent/main.ts");

function mockAgentEnvironment(mockAgent: MockAgent): Record<string, string> {
  return {
    AGENTCONTROL_AGENT_MOCK_CMD: JSON.stringify(["bun", mockAgentMain]),
    MOCK_AGENT_SCRIPT: mockAgent.scriptPath,
  };
}

/** What a test may ask of the parts around the app. */
export interface WorkspaceOptions {
  /** Extra environment for the relay, for example the command behind an agent name. */
  relayEnv?: Record<string, string>;
  /** The repo holds this many files besides its readme. */
  repoFiles?: number;
  /** The version the relay reports it is, when it is not this release. */
  relayVersion?: string;
}

/** A fresh data folder, local repo, mock agent and relay, all torn down when the test ends. */
export async function prepareWorkspace(options: WorkspaceOptions) {
  const dataDir = await mkdtemp(join(tmpdir(), "agentcontrol-app-"));
  onTestEnd(() => rm(dataDir, { recursive: true, force: true }));
  const repoPath = await createLocalRepo({ extraFiles: options.repoFiles ?? 0 });
  const mockAgent = await createMockAgent();
  const env = { ...mockAgentEnvironment(mockAgent), ...options.relayEnv };
  const home = { dataDir: join(dataDir, "relay"), env };
  const host = await startRelayHost(
    options.relayVersion === undefined ? home : { ...home, relayVersion: options.relayVersion },
  );
  onTestEnd(() => host.stop());
  return { dataDir, repoPath, mockAgent, env, host };
}
