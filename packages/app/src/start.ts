import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { RelayClient } from "./relays/index.ts";
import { startServer } from "./server/index.ts";
import { createStore, type Workspace } from "./store/index.ts";
import { createHub, startSync } from "./sync/index.ts";

export interface AppOptions {
  dataDir: string;
  /** The port to listen on; 0 picks a free one. */
  port: number;
  /** Opens a fresh connection to the local relay; called again after every drop. */
  connectRelay: () => RelayClient;
}

export interface RunningApp {
  /** Where the app is listening, e.g. `http://127.0.0.1:4747`. */
  url: string;
  /** Stops serving, closes the relay connection (the relay keeps running) and the database. */
  stop(): Promise<void>;
}

/** Starts the app on 127.0.0.1 with its own database under `dataDir`, once the relay is synced. */
export async function startApp(options: AppOptions): Promise<RunningApp> {
  await mkdir(options.dataDir, { recursive: true });
  const store = createStore({ path: join(options.dataDir, "state.db") });
  const hub = createHub();
  const workspace: Workspace = { id: "local", label: "This Mac", kind: "local" };
  const sync = startSync({
    store,
    hub,
    workspace,
    connect: options.connectRelay,
  });
  const server = await Promise.try(async () => {
    await sync.ready;
    return startServer({ port: options.port, deps: { store, hub, workspace, relay: sync } });
  }).catch(async (error: unknown) => {
    await sync.stop();
    store.close();
    throw error;
  });
  return {
    url: `http://127.0.0.1:${String(server.port)}`,
    stop: async () => {
      await server.stop();
      await sync.stop();
      store.close();
    },
  };
}
