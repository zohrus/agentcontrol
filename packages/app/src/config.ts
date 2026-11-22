import { homedir } from "node:os";
import { join } from "node:path";

export interface AppConfig {
  port: number;
  dataDir: string;
  /** A UI project folder to serve with Vite's dev server (hot reload). */
  uiRoot: string | undefined;
  /** A folder of built UI files to serve as they are. Wins over `uiRoot`. */
  uiDist: string | undefined;
  /** The folder with the relay binaries (`agentcontrol-relay-linux-x64`, ...) to install on ssh hosts. */
  relayBinaries: string | undefined;
}

const DEFAULT_PORT = 4747;

function flag(args: string[], name: string): string | undefined {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
}

/**
 * Reads `--port`, `--data-dir`, `--ui-root`, `--ui-dist` and `--relay-binaries`, then
 * AGENTCONTROL_PORT, AGENTCONTROL_HOME, AGENTCONTROL_UI_ROOT, AGENTCONTROL_UI_DIST and
 * AGENTCONTROL_RELAY_BINARIES, then defaults (no UI).
 */
export function readConfig(options: {
  args: string[];
  env: Record<string, string | undefined>;
}): AppConfig {
  const { args, env } = options;
  const option = (name: string, variable: string): string | undefined =>
    flag(args, `--${name}`) ?? env[variable];
  const port = option("port", "AGENTCONTROL_PORT");
  return {
    port: port === undefined ? DEFAULT_PORT : Number(port),
    dataDir: option("data-dir", "AGENTCONTROL_HOME") ?? join(homedir(), ".agentcontrol"),
    uiRoot: option("ui-root", "AGENTCONTROL_UI_ROOT"),
    uiDist: option("ui-dist", "AGENTCONTROL_UI_DIST"),
    relayBinaries: option("relay-binaries", "AGENTCONTROL_RELAY_BINARIES"),
  };
}
