import { homedir } from "node:os";
import { join } from "node:path";

export interface AppConfig {
  port: number;
  dataDir: string;
}

const DEFAULT_PORT = 4747;

function flag(args: string[], name: string): string | undefined {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
}

/** Reads `--port` and `--data-dir`, then AGENTCONTROL_PORT and AGENTCONTROL_HOME, then defaults. */
export function readConfig(options: {
  args: string[];
  env: Record<string, string | undefined>;
}): AppConfig {
  const { args, env } = options;
  const port = flag(args, "--port") ?? env["AGENTCONTROL_PORT"];
  const dataDir = flag(args, "--data-dir") ?? env["AGENTCONTROL_HOME"];
  return {
    port: port === undefined ? DEFAULT_PORT : Number(port),
    dataDir: dataDir ?? join(homedir(), ".agentcontrol"),
  };
}
