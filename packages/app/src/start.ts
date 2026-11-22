import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createModify, type ModifyConfig, readModifyConfig } from "./modify/index.ts";
import type { RelayClient } from "./relays/index.ts";
import { startServer } from "./server/index.ts";
import { createStore, type Store } from "./store/index.ts";
import { createHub, type Hub } from "./sync/index.ts";
import { startUi, type UiHandler, type UiSource } from "./ui-serving/index.ts";
import {
  createWorkspaces,
  relayBinariesIn,
  type SshSettings,
  type Workspaces,
} from "./workspaces/index.ts";

export interface AppOptions {
  dataDir: string;
  /** The port to listen on; 0 picks a free one. */
  port: number;
  /** Opens a fresh connection to the local relay; called again after every drop. */
  connectRelay: () => RelayClient;
  /**
   * How ssh workspaces are reached. By default the system's ssh config is used and relay binaries
   * are looked for in the `dist/` folder of a source checkout.
   */
  ssh?: Partial<SshSettings>;
  /**
   * Which agent edits the UI and where the default UI is. Given: the live and staging UI folders
   * are prepared before the app listens. Absent: they are prepared on the first Modify request.
   */
  modify?: ModifyConfig;
  /** The UI to serve besides the API; none by default. */
  ui?: UiSource;
}

export interface RunningApp {
  /** Where the app is listening, e.g. `http://127.0.0.1:4747`. */
  url: string;
  /** Stops serving, closes the relay connections (the relays keep running) and the database. */
  stop(): Promise<void>;
}

const sourceCheckoutBinaries = join(import.meta.dir, "../../../dist");

function modifyOf(options: AppOptions, parts: { store: Store; hub: Hub; workspaces: Workspaces }) {
  const { store, hub, workspaces } = parts;
  return createModify({
    dataDir: options.dataDir,
    ...(options.modify ?? readModifyConfig(process.env)),
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

interface Parts {
  store: Store;
  hub: Hub;
  workspaces: Workspaces;
  ui: UiHandler | undefined;
}

async function listen(options: AppOptions, parts: Parts) {
  await parts.workspaces.ready();
  const modify = modifyOf(options, parts);
  if (options.modify) await modify.ready();
  return startServer({ port: options.port, deps: { ...parts, modify }, ui: parts.ui });
}

/** Starts the app on 127.0.0.1 with its own database under `dataDir`, once the local relay is synced. */
export async function startApp(options: AppOptions): Promise<RunningApp> {
  await mkdir(options.dataDir, { recursive: true });
  const store = createStore({ path: join(options.dataDir, "state.db") });
  const hub = createHub();
  const ssh = { relayBinaryFor: relayBinariesIn(sourceCheckoutBinaries), ...options.ssh };
  const workspaces = createWorkspaces({ store, hub, connectLocal: options.connectRelay, ssh });
  let ui: UiHandler | undefined;
  const server = await Promise.try(async () => {
    const started = await startUi(options.ui ?? {});
    ui = started;
    return listen(options, { store, hub, workspaces, ui: started });
  }).catch(async (error: unknown) => {
    await ui?.close();
    await workspaces.stop();
    store.close();
    throw error;
  });
  return {
    url: `http://127.0.0.1:${String(server.port)}`,
    stop: async () => {
      await server.stop();
      await ui?.close();
      await workspaces.stop();
      store.close();
    },
  };
}
