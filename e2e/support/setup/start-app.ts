import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type SessionEvent } from "@agentcontrol/sdk";
import type { AppAccess, FileChange } from "./app.ts";
import { type AppProcess, launchApp } from "./app-process.ts";
import { type AppUser, appUserOf } from "./app-user.ts";
import { onTestEnd } from "./cleanup.ts";
import { createLocalRepo } from "./local-repo.ts";
import { createMockAgent, type MockAgent } from "./mock-agent-script.ts";
import { type RelayHost, startRelayHost } from "./relay-host.ts";
import { Timeline } from "./timeline.ts";

const mockAgentMain = join(import.meta.dir, "../mock-agent/main.ts");
const STREAM_WAIT_MS = 5000;

/** The app running with one local workspace, driven the way a user's browser drives it. */
export interface RunningApp extends AppAccess {
  readonly dataDir: string;
  readonly user: AppUser;
  /** Quits the app and starts it again on the same data folder; the relay keeps running. */
  restartsTheApp(): Promise<void>;
  /** Stops the relay daemon while the app keeps running. */
  theRelayStops(): Promise<void>;
  /** Starts the relay daemon again; the app is expected to find it on its own. */
  theRelayStartsAgain(): Promise<void>;
}

/** What the live stream has delivered so far. */
interface Heard {
  streamed: Timeline<SessionEvent>;
  fileChanges: Timeline<FileChange>;
  /** One entry per relay connection the app has seen end, numbered from 1. */
  relayConnectionsEnded: Timeline<number>;
}

/** Opens the live stream and resolves once the app has confirmed it, so no event is missed. */
function followLiveStream(sdk: AppAccess["sdk"], heard: Heard): Promise<() => void> {
  return new Promise((resolve) => {
    const stop = sdk.subscribe({
      onEvent: (event) => {
        heard.streamed.record(event);
      },
      onFilesChanged: (change) => {
        heard.fileChanges.record(change);
      },
      onOpen: () => {
        resolve(stop);
      },
    });
  });
}

function mockAgentEnvironment(mockAgent: MockAgent): Record<string, string> {
  return {
    AGENTCONTROL_AGENT_MOCK_CMD: JSON.stringify(["bun", mockAgentMain]),
    MOCK_AGENT_SCRIPT: mockAgent.scriptPath,
  };
}

function newHeard(): Heard {
  return {
    streamed: new Timeline<SessionEvent>(STREAM_WAIT_MS),
    fileChanges: new Timeline<FileChange>(STREAM_WAIT_MS),
    relayConnectionsEnded: new Timeline<number>(STREAM_WAIT_MS),
  };
}

/** Starts an app on a fresh data folder with a local git repo and the mock agent. */
export async function startAppWithLocalWorkspace(): Promise<RunningApp> {
  const dataDir = await mkdtemp(join(tmpdir(), "agentcontrol-app-"));
  onTestEnd(() => rm(dataDir, { recursive: true, force: true }));
  const repoPath = await createLocalRepo();
  const mockAgent = await createMockAgent();
  const env = mockAgentEnvironment(mockAgent);
  const host = await startRelayHost({ dataDir: join(dataDir, "relay"), env });
  onTestEnd(() => host.stop());
  const heard = newHeard();
  let current = await openApp({ dataDir, env, host, heard });
  onTestEnd(() => current.close());
  const access: AppAccess = {
    mockAgent,
    repoPath,
    ...heard,
    get sdk() {
      return current.sdk;
    },
  };
  return Object.assign(access, {
    dataDir,
    user: appUserOf(access),
    restartsTheApp: async () => {
      await current.close();
      current = await openApp({ dataDir, env, host, heard });
    },
    theRelayStops: () => host.stop(),
    theRelayStartsAgain: () => host.start(),
  });
}

interface Opened {
  sdk: AppAccess["sdk"];
  close(): Promise<void>;
}

async function openApp(options: {
  dataDir: string;
  env: Record<string, string>;
  host: RelayHost;
  heard: Heard;
}): Promise<Opened> {
  const { heard } = options;
  const app: AppProcess = await launchApp({
    ...options,
    onRelayConnectionEnded: () => {
      heard.relayConnectionsEnded.record(heard.relayConnectionsEnded.entries.length + 1);
    },
  });
  const sdk = createClient({ baseUrl: app.baseUrl });
  const stopStream = await followLiveStream(sdk, heard);
  return {
    sdk,
    close: async () => {
      stopStream();
      await app.stop();
    },
  };
}
