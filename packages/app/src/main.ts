import { join } from "node:path";
import { readConfig } from "./config.ts";
import { readModifyConfig } from "./modify/index.ts";
import { localRelayCommand, localTarget, relayClientOver, spawnBridge } from "./relays/index.ts";
import { findResources } from "./resources/index.ts";
import { startApp } from "./start.ts";

const config = readConfig({ args: process.argv.slice(2), env: process.env });
const target = localTarget({
  command: localRelayCommand(process.env),
  dataDir: join(config.dataDir, "relay"),
});
// A release has no source tree to point --ui-root at: it serves a production build of the UI
// folder in the data folder. Only --ui-root (`bun dev`) runs Vite's dev server.
const shipped = findResources({ env: process.env, execPath: process.execPath }).shipped;
const production = shipped && config.uiRoot === undefined && config.uiDist === undefined;
const app = await startApp({
  dataDir: config.dataDir,
  port: config.port,
  modify: readModifyConfig(process.env),
  ui: { root: config.uiRoot, dist: config.uiDist, production },
  connectRelay: () => relayClientOver(spawnBridge({ argv: target.bridgeCommand() })),
  stopLocalRelay: () => target.stopRelay(),
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
console.log(`AgentControl listening on ${app.url}`);

let stopping = false;
async function shutDown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  await app.stop();
  process.exit(0);
}
process.on("SIGINT", () => void shutDown());
process.on("SIGTERM", () => void shutDown());
