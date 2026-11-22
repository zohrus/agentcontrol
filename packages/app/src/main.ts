import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { connectRelay, localRelayCommand } from "./relays/index.ts";
import { readConfig } from "./config.ts";
import { startServer } from "./server/index.ts";
import { createStore, type Workspace } from "./store/index.ts";
import { startUi } from "./ui-serving/index.ts";
import { createHub, startSync } from "./sync/index.ts";

const config = readConfig({ args: process.argv.slice(2), env: process.env });
await mkdir(config.dataDir, { recursive: true });
const store = createStore({ path: join(config.dataDir, "state.db") });
const hub = createHub();
const relayDir = join(config.dataDir, "relay");
const command = localRelayCommand(process.env);
const workspace: Workspace = { id: "local", label: "This Mac", kind: "local" };
const sync = startSync({
  store,
  hub,
  workspace,
  connect: () => connectRelay({ command, dataDir: relayDir }),
});
await sync.ready;
const ui = await startUi({ root: config.uiRoot, dist: config.uiDist });
const server = startServer({
  port: config.port,
  deps: { store, hub, workspace, relay: sync },
  ui,
});
console.log(`AgentControl listening on http://127.0.0.1:${String(server.port)}`);

let stopping = false;
async function shutDown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  await server.stop();
  await ui?.close();
  await sync.stop();
  store.close();
  process.exit(0);
}
process.on("SIGINT", () => void shutDown());
process.on("SIGTERM", () => void shutDown());
