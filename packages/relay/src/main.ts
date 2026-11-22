import { homedir } from "node:os";
import { join } from "node:path";
import { runBridge, runDaemon, stopDaemon } from "./daemon/index.ts";

const commands: Record<string, (dataDir: string) => Promise<void>> = {
  daemon: runDaemon,
  "--stdio": runBridge,
  stop: stopDaemon,
};

function dataDirFrom(args: string[]): string {
  const flag = args.indexOf("--data-dir");
  const given = flag === -1 ? undefined : args[flag + 1];
  const home = process.env["AGENTCONTROL_RELAY_HOME"];
  return given ?? home ?? join(homedir(), ".agentcontrol", "relay");
}

const args = process.argv.slice(2);
const command = commands[args[0] ?? ""];
if (command === undefined) {
  console.error("Usage: main.ts daemon|--stdio|stop [--data-dir <dir>]");
  process.exit(2);
}
await command(dataDirFrom(args));
