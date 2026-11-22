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
  /** Where the app listens now; a browser opens its UI here (when started `withUi`). */
  readonly baseUrl: string;
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

export interface StartOptions {
  /** Also serve the default UI, so a browser can use the app. */
  withUi?: boolean;
  /** Serve this folder of built UI files instead (what a release does). */
  uiDist?: string;
}

const uiRoot = join(import.meta.dir, "../../../packages/ui-template");

function uiArgs(options: StartOptions): string[] {
  if (options.uiDist !== undefined) return ["--ui-dist", options.uiDist];
  return options.withUi ? ["--ui-root", uiRoot] : [];
}

/** A fresh data folder, a local git repo and a mock agent, all removed when the test ends. */
async function prepareWorkspace() {
  const dataDir = await mkdtemp(join(tmpdir(), "agentcontrol-app-"));
  onTestEnd(() => rm(dataDir, { recursive: true, force: true }));
  const repoPath = await createLocalRepo();
  const mockAgent = await createMockAgent();
  const env = {
    AGENTCONTROL_AGENT_MOCK_CMD: JSON.stringify(["bun", mockAgentMain]),
    MOCK_AGENT_SCRIPT: mockAgent.scriptPath,
  };
  onTestEnd(() => stopRelayDaemon(join(dataDir, "relay")));
  return { dataDir, repoPath, mockAgent, env };
}

/** Starts an app on a fresh data folder with a local git repo and the mock agent. */
export async function startAppWithLocalWorkspace(options: StartOptions = {}): Promise<RunningApp> {
  const { dataDir, repoPath, mockAgent, env } = await prepareWorkspace();
  const streamed = new Timeline<SessionEvent>(STREAM_WAIT_MS);
  const extraArgs = uiArgs(options);
  let current = await openApp({ dataDir, env, streamed, extraArgs });
  onTestEnd(() => current.close());
  const access: AppAccess = {
    mockAgent,
    repoPath,
    streamed,
    get sdk() {
      return current.sdk;
    },
  };
  const baseUrlOf = () => current.baseUrl;
  return Object.assign(access, {
    dataDir,
    get baseUrl() {
      return baseUrlOf();
    },
    user: appUserOf(access),
    restartsTheApp: async () => {
      const port = Number(new URL(current.baseUrl).port);
      await current.close();
      current = await openApp({ dataDir, env, streamed, port, extraArgs });
    },
  });
}

interface Opened {
  baseUrl: string;
  sdk: AppAccess["sdk"];
  close(): Promise<void>;
}

async function openApp(options: {
  dataDir: string;
  env: Record<string, string>;
  streamed: Timeline<SessionEvent>;
  port?: number;
  extraArgs: string[];
}): Promise<Opened> {
  const app: AppProcess = await launchApp(options);
  const sdk = createClient({ baseUrl: app.baseUrl });
  const stopStream = await followLiveStream(sdk, options.streamed);
  return {
    baseUrl: app.baseUrl,
    sdk,
    close: async () => {
      stopStream();
      await app.stop();
    },
  };
}
