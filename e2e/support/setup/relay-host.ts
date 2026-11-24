import { join } from "node:path";
import { startRelayDaemon } from "@agentcontrol/relay";
import { type Wire, bridgeWire, socketWire } from "./wire.ts";

const relayMain = join(import.meta.dir, "../../../packages/relay/src/main.ts");

/** Set `AGENTCONTROL_E2E_PROCESSES=1` to run the product as real subprocesses, as shipped. */
export const inSubprocesses = Bun.env["AGENTCONTROL_E2E_PROCESSES"] === "1";

export interface RelayHome {
  dataDir: string;
  env: Record<string, string>;
  /** The version the relay reports (a daemon in the test process only); this release's if left out. */
  relayVersion?: string;
  /** Held in `relay/terminal.open` before the shell starts (a daemon in the test process only). */
  beforeShellStarts?: () => Promise<void>;
}

/** The relay daemon of one test: reachable by wires, and able to be stopped and started again. */
export interface RelayHost {
  /** A fresh connection, as the app opens one. */
  wire(): Wire;
  /** Stops the daemon, its agents with it. */
  stop(): Promise<void>;
  /**
   * Starts the daemon again on the same data folder (a bridge also does it when connected). A
   * daemon running in the test process can start with another event translation version.
   */
  start(options?: { normaliserVersion?: number }): Promise<void>;
}

export async function stopDaemonProcess(dataDir: string): Promise<void> {
  const stop = Bun.spawn(["bun", relayMain, "stop", "--data-dir", dataDir], {
    stdout: "inherit",
    stderr: "inherit",
  });
  await stop.exited;
}

/** The relay as a detached process, started by the first bridge that needs it. */
function relayProcess(home: RelayHome): RelayHost {
  return {
    wire: () => bridgeWire({ relayMain, ...home }),
    stop: () => stopDaemonProcess(home.dataDir),
    start: () => Promise.resolve(),
  };
}

/** The relay running inside the test process, reached over its socket. */
async function relayInProcess(home: RelayHome): Promise<RelayHost> {
  let daemon = await startRelayDaemon(home);
  return {
    wire: () => socketWire(daemon.socketPath),
    stop: () => daemon.stop(),
    start: async (options = {}) => {
      daemon = await startRelayDaemon({ ...home, ...options });
    },
  };
}

/** Starts the relay on the given data folder, in this process unless subprocesses were asked for. */
export function startRelayHost(home: RelayHome): Promise<RelayHost> {
  return inSubprocesses ? Promise.resolve(relayProcess(home)) : relayInProcess(home);
}
