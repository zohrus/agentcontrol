import { join } from "node:path";
import { readConfig } from "./config.ts";
import { readModifyConfig } from "./modify/index.ts";
import { localRelayCommand, localTarget, relayClientOver, spawnBridge } from "./relays/index.ts";
import { startApp } from "./start.ts";
import { relayBinariesIn } from "./workspaces/index.ts";

const config = readConfig({ args: process.argv.slice(2), env: process.env });
const target = localTarget({
  command: localRelayCommand(process.env),
  dataDir: join(config.dataDir, "relay"),
});
const app = await startApp({
  dataDir: config.dataDir,
  port: config.port,
  modify: readModifyConfig(process.env),
  ui: { root: config.uiRoot, dist: config.uiDist },
  connectRelay: () => relayClientOver(spawnBridge({ argv: target.bridgeCommand() })),
  stopLocalRelay: () => target.stopRelay(),
  ...(config.relayBinaries === undefined
    ? {}
    : { ssh: { relayBinaryFor: relayBinariesIn(config.relayBinaries) } }),
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
