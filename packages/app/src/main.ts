import { join } from "node:path";
import { readConfig } from "./config.ts";
import { readModifyConfig } from "./modify/index.ts";
import { localRelayCommand, relayClientOver, spawnRelayBridge } from "./relays/index.ts";
import { findResources } from "./resources/index.ts";
import { startApp } from "./start.ts";

const config = readConfig({ args: process.argv.slice(2), env: process.env });
const command = localRelayCommand(process.env);
// A release has no source tree to point --ui-root at: it serves the UI folder in the data folder.
const shipped = findResources({ env: process.env, execPath: process.execPath }).shipped;
const uiRoot =
  config.uiRoot ??
  (shipped && config.uiDist === undefined ? join(config.dataDir, "ui") : undefined);
const dataDir = join(config.dataDir, "relay");
const app = await startApp({
  dataDir: config.dataDir,
  port: config.port,
  modify: readModifyConfig(process.env),
  ui: { root: uiRoot, dist: config.uiDist },
  connectRelay: () => relayClientOver(spawnRelayBridge({ command, dataDir })),
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
