import { join } from "node:path";
import { onTestEnd } from "./cleanup.ts";
import { aDataFolder } from "./data-folder.ts";
import { createLocalRepo } from "./local-repo.ts";
import { createMockAgent, type MockAgent } from "./mock-agent-script.ts";
import { startRelayHost } from "./relay-host.ts";
import { aSessionWorkingInTheRelay } from "./relay-working-session.ts";

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
  /** The code the relay says it runs, when it is not this checkout's: same version, other build. */
  relayBuildId?: string;
  /** A session in the relay is working, started before any app was, as an earlier app left it. */
  relayHasAWorkingSession?: boolean;
  /** The data folder is given as a link to the real folder, as macOS's temp folder (/var) is. */
  dataFolderBehindALink?: boolean;
  /** Puts files into the app's data folder before the app starts, as an earlier release left them. */
  beforeTheAppStarts?: (dataDir: string) => Promise<void>;
}

/** What the relay says it is, when a test has it say something other than this checkout's own. */
function saysItIs(options: WorkspaceOptions) {
  return {
    ...(options.relayVersion !== undefined && { relayVersion: options.relayVersion }),
    ...(options.relayBuildId !== undefined && { buildId: options.relayBuildId }),
  };
}

/** The relay on its own data folder, with a session already working in it when a test wants one. */
async function startRelay(call: {
  options: WorkspaceOptions;
  dataDir: string;
  env: Record<string, string>;
  repoPath: string;
  mockAgent: MockAgent;
}) {
  const { options, dataDir, env, repoPath, mockAgent } = call;
  const host = await startRelayHost({ dataDir: join(dataDir, "relay"), env, ...saysItIs(options) });
  onTestEnd(() => host.stop());
  if (options.relayHasAWorkingSession) {
    await aSessionWorkingInTheRelay({ host, mockAgent, repoPath });
  }
  return host;
}

/** A fresh data folder, local repo, mock agent and relay, all torn down when the test ends. */
export async function prepareWorkspace(options: WorkspaceOptions) {
  const dataDir = await aDataFolder(options.dataFolderBehindALink === true);
  await options.beforeTheAppStarts?.(dataDir);
  const repoPath = await createLocalRepo({ extraFiles: options.repoFiles ?? 0 });
  const mockAgent = await createMockAgent();
  const env = { ...mockAgentEnvironment(mockAgent), ...options.relayEnv };
  const host = await startRelay({ options, dataDir, env, repoPath, mockAgent });
  return { dataDir, repoPath, mockAgent, env, host };
}
