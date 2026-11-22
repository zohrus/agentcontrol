import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type SessionEvent } from "@agentcontrol/sdk";
import type { AppAccess } from "./app.ts";
import { type AppProcess, launchApp } from "./app-process.ts";
import { type AppUser, appUserOf } from "./app-user.ts";
import { onTestEnd } from "./cleanup.ts";
import { createLocalRepo } from "./local-repo.ts";
import { createMockAgent } from "./mock-agent-script.ts";
import { stopRelayDaemon } from "./relay-client.ts";
import { Timeline } from "./timeline.ts";

const mockAgentMain = join(import.meta.dir, "../mock-agent/main.ts");
const STREAM_WAIT_MS = 5000;

/** The app running with one local workspace, driven the way a user's browser drives it. */
export interface RunningApp extends AppAccess {
  readonly dataDir: string;
  readonly user: AppUser;
  /** Quits the app and starts it again on the same data folder; the relay keeps running. */
  restartsTheApp(): Promise<void>;
}

/** Opens the live stream and resolves once the app has confirmed it, so no event is missed. */
function followLiveStream(
  sdk: AppAccess["sdk"],
  streamed: Timeline<SessionEvent>,
): Promise<() => void> {
  return new Promise((resolve) => {
    const stop = sdk.subscribe({
      onEvent: (event) => {
        streamed.record(event);
      },
      onOpen: () => {
        resolve(stop);
      },
    });
  });
}

/** Starts an app on a fresh data folder with a local git repo and the mock agent. */
export async function startAppWithLocalWorkspace(): Promise<RunningApp> {
  const dataDir = await mkdtemp(join(tmpdir(), "agentcontrol-app-"));
  onTestEnd(() => rm(dataDir, { recursive: true, force: true }));
  const repoPath = await createLocalRepo();
  const mockAgent = await createMockAgent();
  const env = {
    AGENTCONTROL_AGENT_MOCK_CMD: JSON.stringify(["bun", mockAgentMain]),
    MOCK_AGENT_SCRIPT: mockAgent.scriptPath,
  };
  onTestEnd(() => stopRelayDaemon(join(dataDir, "relay")));
  const streamed = new Timeline<SessionEvent>(STREAM_WAIT_MS);
  let current = await openApp({ dataDir, env, streamed });
  onTestEnd(() => current.close());
  const access: AppAccess = {
    mockAgent,
    repoPath,
    streamed,
    get sdk() {
      return current.sdk;
    },
  };
  return Object.assign(access, {
    dataDir,
    user: appUserOf(access),
    restartsTheApp: async () => {
      await current.close();
      current = await openApp({ dataDir, env, streamed });
    },
  });
}

interface Opened {
  sdk: AppAccess["sdk"];
  close(): Promise<void>;
}

async function openApp(options: {
  dataDir: string;
  env: Record<string, string>;
  streamed: Timeline<SessionEvent>;
}): Promise<Opened> {
  const app: AppProcess = await launchApp(options);
  const sdk = createClient({ baseUrl: app.baseUrl });
  const stopStream = await followLiveStream(sdk, options.streamed);
  return {
    sdk,
    close: async () => {
      stopStream();
      await app.stop();
    },
  };
}
