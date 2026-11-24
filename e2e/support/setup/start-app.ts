import { join } from "node:path";
import type { SessionSummary } from "@agentcontrol/protocol";
import { createClient } from "@agentcontrol/sdk";
import type { ModifyConfig, SshSettings } from "@agentcontrol/app";
import type { AppAccess } from "./app.ts";
import { type AppProcess, launchApp } from "./app-process.ts";
import { type AppUser, appUserOf } from "./app-user.ts";
import { onTestEnd } from "./cleanup.ts";
import { readApiToken } from "./api-token.ts";
import { aBrowser, type Browser } from "./browser.ts";
import { type Outsiders, outsidersOf } from "./outsiders.ts";
import { sessionsOfRelay } from "./relay-peek.ts";
import type { RelayHost } from "./relay-host.ts";
import { countEndedConnections, followLiveStream, type Heard, newHeard } from "./live-heard.ts";
import type { Wire } from "./wire.ts";
import { prepareWorkspace, type WorkspaceOptions } from "./workspace-parts.ts";

/** The app running with one local workspace, driven the way a user's browser drives it. */
export interface RunningApp extends AppAccess, Outsiders {
  /** A browser that has not opened any page of the app yet. */
  aBrowser(): Browser;
  readonly dataDir: string;
  readonly user: AppUser;
  /** The relay daemon the app is connected to. */
  readonly relay: RelayHost;
  /** Quits the app and starts it again on the same data folder; the relay keeps running. */
  restartsTheApp(restart?: { modify?: ModifyConfig }): Promise<void>;
  /** The sessions the relay itself lists, whatever the app knows of them. */
  readsTheRelaySessions(): Promise<SessionSummary[]>;
  /** Stops the relay daemon while the app keeps running. */
  theRelayStops(): Promise<void>;
  /**
   * Starts the relay daemon again; the app is expected to find it on its own. The new relay may be
   * one that translates the agents' messages differently (a higher version).
   */
  theRelayStartsAgain(options?: { normaliserVersion?: number }): Promise<void>;
}

export interface StartOptions extends WorkspaceOptions {
  /** Also serve the default UI, so a browser can use the app. */
  withUi?: boolean;
  /** Serve this folder of built UI files instead (what a release does). */
  uiDist?: string;
  /** The default UI and the agent that edits it; the live and staging UI are ready at start. */
  modify?: ModifyConfig;
  /** How long a preview link stays valid after its last use, in milliseconds (default: an hour). */
  previewLifetimeMs?: number;
  ssh?: Partial<SshSettings>;
  /** Wraps each connection the app opens to the relay, to make the relay misbehave (in-process runs only). */
  relayWire?: (wire: Wire) => Wire;
  /** Stop the relay before the app starts, so the app finds none. */
  relayStopped?: boolean;
  /** The app can stop the relay of this machine, as it always can in a real run, and does so to replace one. */
  appCanReplaceTheRelay?: boolean;
}

const uiRoot = join(import.meta.dir, "../../../packages/ui-template");

function uiOf(options: StartOptions): { root?: string; dist?: string } {
  if (options.uiDist !== undefined) return { dist: options.uiDist };
  return options.withUi ? { root: uiRoot } : {};
}

/** The parts of the access every helper uses, reading the SDK and URL of the app as it is now. */
function accessOf(options: {
  base: Omit<AppAccess, "sdk" | "baseUrl" | "token">;
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
    get token() {
      return current().token;
    },
  };
}

/** What the test says about how the app is wired to the relay and to ssh hosts. */
function wiringOf(options: StartOptions) {
  return {
    relayWire: options.relayWire,
    canReplace: options.appCanReplaceTheRelay,
    previewLifetimeMs: options.previewLifetimeMs,
    ssh: options.ssh,
  };
}

/** Starts an app on a fresh data folder with a local git repo and the mock agent. */
export async function startAppWithLocalWorkspace(options: StartOptions = {}): Promise<RunningApp> {
  const { dataDir, repoPath, mockAgent, env, host } = await prepareWorkspace(options);
  if (options.relayStopped) await host.stop();
  const heard = newHeard();
  const ui = uiOf(options);
  const fixed = { dataDir, env, host, heard, ui, relayDown: options.relayStopped };
  const open = (extra: { port?: number; modify?: ModifyConfig | undefined }) =>
    openApp({ ...fixed, ...wiringOf(options), ...extra });
  let current = await open({ modify: options.modify });
  onTestEnd(() => current.close());
  const access = accessOf({
    base: { dataDir, mockAgent, repoPath, ...heard },
    current: () => current,
  });
  return Object.assign(access, {
    user: appUserOf(access),
    ...outsidersOf(access),
    aBrowser: () => aBrowser(access),
    restartsTheApp: async (restart: { modify?: ModifyConfig } = {}) => {
      const port = Number(new URL(current.baseUrl).port);
      await current.close();
      current = await open({ port, modify: restart.modify ?? options.modify });
    },
    relay: host,
    readsTheRelaySessions: () => sessionsOfRelay(host),
    theRelayStops: () => host.stop(),
    theRelayStartsAgain: (relay?: { normaliserVersion?: number }) => host.start(relay),
  });
}

interface Opened {
  baseUrl: string;
  token: string;
  sdk: AppAccess["sdk"];
  close(): Promise<void>;
}

interface OpenOptions {
  dataDir: string;
  env: Record<string, string>;
  host: RelayHost;
  heard: Heard;
  ui: { root?: string; dist?: string };
  ssh?: Partial<SshSettings> | undefined;
  relayDown: boolean | undefined;
  canReplace: boolean | undefined;
  port?: number;
  modify?: ModifyConfig | undefined;
  previewLifetimeMs?: number | undefined;
  relayWire?: ((wire: Wire) => Wire) | undefined;
}

async function openApp(options: OpenOptions): Promise<Opened> {
  const { heard } = options;
  const app: AppProcess = await launchApp({
    ...options,
    onRelayConnectionEnded: countEndedConnections(heard),
  });
  const token = await readApiToken(options.dataDir);
  const sdk = createClient({ baseUrl: app.baseUrl, token });
  const stopStream = await followLiveStream(sdk, heard);
  return {
    baseUrl: app.baseUrl,
    token,
    sdk,
    close: async () => {
      stopStream();
      await app.stop();
    },
  };
}
