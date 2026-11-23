import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createModify, type ModifyConfig, readModifyConfig } from "./modify/index.ts";
import type { RelayClient } from "./relays/index.ts";
import { createToken } from "./security/index.ts";
import { startServer } from "./server/index.ts";
import { createStore, type Store, type Workspace } from "./store/index.ts";
import { createHub, type Hub, startSync, type Sync } from "./sync/index.ts";
import { startUi, type UiHandler, type UiSource } from "./ui-serving/index.ts";

export interface AppOptions {
  dataDir: string;
  /** The port to listen on; 0 picks a free one. */
  port: number;
  /** Opens a fresh connection to the local relay; called again after every drop. */
  connectRelay: () => RelayClient;
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
  /** Stops serving, closes the relay connection (the relay keeps running) and the database. */
  stop(): Promise<void>;
}

function modifyOf(options: AppOptions, parts: { store: Store; hub: Hub; sync: Sync }) {
  const { store, hub, sync } = parts;
  return createModify({
    dataDir: options.dataDir,
    ...(options.modify ?? readModifyConfig(process.env)),
    relay: sync,
    events: {
      after: (query) =>
        store.eventsAfter({ ...query, workspaceId: LOCAL.id, limit: Number.MAX_SAFE_INTEGER }),
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

/** A busy port gets a plain message that says what to do; every other failure is kept as it is. */
function explainStartFailure(error: unknown, port: number): unknown {
  if (!(error instanceof Error) || (error as { code?: string }).code !== "EADDRINUSE") return error;
  return new Error(
    `Port ${String(port)} is already in use. AgentControl may already be running: open http://127.0.0.1:${String(port)}. To run another copy, pick a free port, for example: bun dev --port ${String(port + 1)}`,
    { cause: error },
  );
}

const LOCAL: Workspace = { id: "local", label: "This Mac", kind: "local" };

/** Starts the app on 127.0.0.1 with its own database under `dataDir`, once the relay is synced. */
export async function startApp(options: AppOptions): Promise<RunningApp> {
  await mkdir(options.dataDir, { recursive: true });
  const token = createToken();
  const store = createStore({ path: join(options.dataDir, "state.db") });
  const hub = createHub();
  const sync = startSync({ store, hub, workspace: LOCAL, connect: options.connectRelay });
  let ui: UiHandler | undefined;
  const server = await Promise.try(async () => {
    ui = await startUi(options.ui ?? {});
    await sync.ready;
    const modify = modifyOf(options, { store, hub, sync });
    if (options.modify) await modify.ready();
    const deps = { store, hub, workspace: LOCAL, relay: sync, modify };
    return startServer({ port: options.port, deps, ui, token, dataDir: options.dataDir });
  }).catch(async (error: unknown) => {
    await ui?.close();
    await sync.stop();
    store.close();
    throw explainStartFailure(error, options.port);
  });
  return {
    url: `http://127.0.0.1:${String(server.port)}`,
    stop: async () => {
      await server.stop();
      await ui?.close();
      await sync.stop();
      store.close();
    },
  };
}
