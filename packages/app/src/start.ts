import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createModify, type Modify, type ModifyConfig, readModifyConfig } from "./modify/index.ts";
import type { ApiDeps } from "./api/index.ts";
import { createPreviews } from "./preview/index.ts";
import type { RelayClient } from "./relays/index.ts";
import { createToken } from "./security/index.ts";
import { startServer } from "./server/index.ts";
import { explainStartFailure } from "./start-failure.ts";
import { closeParts } from "./start-close.ts";
import { startIde } from "./start-ide.ts";
import { createStore, type Store } from "./store/index.ts";
import { createHub, type Hub } from "./sync/index.ts";
import {
  createBuilds,
  startUi,
  type UiBuilds,
  type UiHandler,
  type UiSource,
} from "./ui-serving/index.ts";
import {
  createWorkspaces,
  type SshSettings,
  shippedRelayBinaries,
  type Workspaces,
} from "./workspaces/index.ts";

export interface AppOptions {
  dataDir: string;
  /** The port to listen on; 0 picks a free one. */
  port: number;
  /** Opens a fresh connection to the local relay; called again after every drop. */
  connectRelay: () => RelayClient;
  /** Stops the local relay daemon; given, an idle relay of another version is replaced at start. */
  stopLocalRelay?: () => Promise<void>;
  /**
   * How ssh workspaces are reached. By default the system's ssh config is used and relay binaries
   * come from the release's `relays/` folder (or `dist/` in a source checkout).
   */
  ssh?: Partial<SshSettings>;
  /**
   * Which agent edits the UI and where the default UI is. Given: the live and staging UI folders
   * are prepared before the app listens. Absent: they are prepared on the first Modify request.
   */
  modify?: ModifyConfig;
  /** The UI to serve besides the API; none by default. */
  ui?: UiSource;
  /**
   * How long a preview link, and a browser VS Code link, stays valid after its last use, in
   * milliseconds; an hour by default.
   */
  previewLifetimeMs?: number;
}

export interface RunningApp {
  /** Where the app is listening, e.g. `http://127.0.0.1:4747`. */
  url: string;
  /** Stops serving, closes the relay connections (the relays keep running) and the database. */
  stop(): Promise<void>;
}

const sourceCheckoutBinaries = join(import.meta.dir, "../../../dist");

function modifyOf(
  options: AppOptions,
  parts: { store: Store; hub: Hub; workspaces: Workspaces; builds: UiBuilds; config: ModifyConfig },
) {
  const { store, hub, workspaces, builds, config } = parts;
  return createModify({
    dataDir: options.dataDir,
    ...config,
    uiBuilds: builds,
    relay: workspaces.localLink,
    events: {
      after: (query) =>
        store.eventsAfter({
          ...query,
          workspaceId: workspaces.localId,
          limit: Number.MAX_SAFE_INTEGER,
        }),
      onEvent: (listener) =>
        hub.subscribe((message) => {
          if (message.type === "event") listener(message.event);
        }),
    },
    publish: (state) => {
      hub.publish({ type: "modify", state });
    },
  });
}

function previewsOf(options: AppOptions) {
  const { previewLifetimeMs } = options;
  return createPreviews(previewLifetimeMs === undefined ? {} : { lifetimeMs: previewLifetimeMs });
}

function workspacesOf(options: AppOptions, parts: { store: Store; hub: Hub }): Workspaces {
  const ssh = { relayBinaryFor: shippedRelayBinaries(sourceCheckoutBinaries), ...options.ssh };
  const { stopLocalRelay } = options;
  return createWorkspaces({
    ...parts,
    connectLocal: options.connectRelay,
    ssh,
    ...(stopLocalRelay && { stopLocalRelay }),
  });
}

interface Parts {
  store: Store;
  hub: Hub;
  workspaces: Workspaces;
  modify: Modify;
  builds: UiBuilds;
  token: ReturnType<typeof createToken>;
  /** Filled in once the UI is up, so a failure after that can close it. */
  opened: { ui?: UiHandler | undefined };
}

/** Starts the app's server beside the browser VS Code's: they stop together, and a failed start stops it. */
async function serveWithIde(call: {
  options: AppOptions;
  deps: Omit<ApiDeps, "ide">;
  ui: UiHandler | undefined;
  token: string;
}) {
  const { options, deps, ui, token } = call;
  const { origin, ide } = startIde({
    lifetimeMs: options.previewLifetimeMs,
    parts: deps,
  });
  try {
    const server = startServer({
      port: options.port,
      deps: { ...deps, ide },
      ui,
      token,
      dataDir: options.dataDir,
    });
    const stop = async (): Promise<void> => {
      await Promise.all([origin.stop(), server.stop()]);
    };
    return { port: server.port, stop };
  } catch (error) {
    await origin.stop();
    throw error;
  }
}

async function listen(options: AppOptions, parts: Parts) {
  const { store, hub, workspaces, modify, builds, token, opened } = parts;
  // The live UI folder is made from the default UI first, because the UI may be served from it.
  if (options.modify || options.ui?.production) await modify.ready();
  const ui = await startUi(options.ui ?? {}, { dataDir: options.dataDir, builds });
  opened.ui = ui;
  const deps = { store, hub, workspaces, modify, previews: previewsOf(options) };
  return serveWithIde({ options, deps, ui, token });
}

/**
 * Starts the app on 127.0.0.1 with its own database under `dataDir`. It does not wait for any
 * relay: each workspace keeps trying in the background, and reads as disconnected until it is up.
 */
export async function startApp(options: AppOptions): Promise<RunningApp> {
  await mkdir(options.dataDir, { recursive: true });
  const token = createToken();
  const store = createStore({ path: join(options.dataDir, "state.db") });
  const hub = createHub();
  const workspaces = workspacesOf(options, { store, hub });
  const config = options.modify ?? readModifyConfig(process.env);
  const builds = createBuilds({
    dataDir: options.dataDir,
    templateDir: config.templateDir,
    version: config.templateVersion,
  });
  const modify = modifyOf(options, { store, hub, workspaces, builds, config });
  const opened: Parts["opened"] = {};
  const parts = { store, hub, workspaces, modify, builds, token, opened };
  const server = await listen(options, parts).catch(async (error: unknown) => {
    await closeParts({ modify, builds, ui: opened.ui, workspaces, store });
    throw explainStartFailure(error, options.port);
  });
  return {
    url: `http://127.0.0.1:${String(server.port)}`,
    stop: async () => {
      await server.stop();
      await closeParts({ modify, builds, ui: opened.ui, workspaces, store });
    },
  };
}
