import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type SessionEvent } from "@agentcontrol/sdk";
import type { ModifyConfig } from "@agentcontrol/app";
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
  /** Where the app listens now; a browser opens its UI here (when started `withUi`). */
  readonly baseUrl: string;
  readonly user: AppUser;
  /** Quits the app and starts it again on the same data folder; the relay keeps running. */
  restartsTheApp(restart?: { modify?: ModifyConfig }): Promise<void>;
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

export interface StartOptions {
  /** Also serve the default UI, so a browser can use the app. */
  withUi?: boolean;
  /** Serve this folder of built UI files instead (what a release does). */
  uiDist?: string;
  /** The default UI and the agent that edits it; the live and staging UI are ready at start. */
  modify?: ModifyConfig;
  /** Extra environment for the relay, for example the command behind an agent name. */
  relayEnv?: Record<string, string>;
}

const uiRoot = join(import.meta.dir, "../../../packages/ui-template");

function uiOf(options: StartOptions): { root?: string; dist?: string } {
  if (options.uiDist !== undefined) return { dist: options.uiDist };
  return options.withUi ? { root: uiRoot } : {};
}

/** A fresh data folder, local repo, mock agent and relay, all torn down when the test ends. */
async function prepareWorkspace(relayEnv: Record<string, string> = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), "agentcontrol-app-"));
  onTestEnd(() => rm(dataDir, { recursive: true, force: true }));
  const repoPath = await createLocalRepo();
  const mockAgent = await createMockAgent();
  const env = { ...mockAgentEnvironment(mockAgent), ...relayEnv };
  const host = await startRelayHost({ dataDir: join(dataDir, "relay"), env });
  onTestEnd(() => host.stop());
  return { dataDir, repoPath, mockAgent, env, host };
}

/** The parts of the access every helper uses, reading the SDK and URL of the app as it is now. */
function accessOf(options: {
  base: Omit<AppAccess, "sdk" | "baseUrl">;
  current: () => Opened;
}): AppAccess {
  const { current } = options;
  return {
    ...options.base,
    get sdk() {
      return current().sdk;
    },
    get baseUrl() {
      return current().baseUrl;
    },
  };
}

/** Starts an app on a fresh data folder with a local git repo and the mock agent. */
export async function startAppWithLocalWorkspace(options: StartOptions = {}): Promise<RunningApp> {
  const { dataDir, repoPath, mockAgent, env, host } = await prepareWorkspace(options.relayEnv);
  const heard = newHeard();
  const ui = uiOf(options);
  const open = (extra: { port?: number; modify?: ModifyConfig | undefined }) =>
    openApp({ dataDir, env, host, heard, ui, ...extra });
  let current = await open({ modify: options.modify });
  onTestEnd(() => current.close());
  const access = accessOf({
    base: { dataDir, mockAgent, repoPath, ...heard },
    current: () => current,
  });
  return Object.assign(access, {
    user: appUserOf(access),
    restartsTheApp: async (restart: { modify?: ModifyConfig } = {}) => {
      const port = Number(new URL(current.baseUrl).port);
      await current.close();
      current = await open({ port, modify: restart.modify ?? options.modify });
    },
    theRelayStops: () => host.stop(),
    theRelayStartsAgain: () => host.start(),
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
  host: RelayHost;
  heard: Heard;
  ui: { root?: string; dist?: string };
  port?: number;
  modify?: ModifyConfig | undefined;
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
    baseUrl: app.baseUrl,
    sdk,
    close: async () => {
      stopStream();
      await app.stop();
    },
  };
}
