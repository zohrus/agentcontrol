import { arch, platform } from "node:os";
import { statfs } from "node:fs/promises";
import { homedir } from "node:os";
import type { WorkspaceTarget } from "./target.ts";

/** This machine: the relay is started by the app's own bridge command and is already in place. */
export function localTarget(options: { command: string[]; dataDir: string }): WorkspaceTarget {
  const { command, dataDir } = options;
  return {
    kind: "local",
    bridgeCommand: () => [...command, "--stdio", "--data-dir", dataDir],
    inspect: async () => {
      const stats = await statfs(homedir());
      return {
        os: platform(),
        arch: arch(),
        freeDiskGb: (stats.bavail * stats.bsize) / 1024 ** 3,
        git: undefined,
      };
    },
    isInstalled: () => Promise.resolve(true),
    install: () => Promise.resolve({ installed: false }),
    forwardPort: (remotePort) =>
      Promise.resolve({ localPort: remotePort, close: () => Promise.resolve() }),
    stopRelay: async () => {
      const stop = Bun.spawn([...command, "stop", "--data-dir", dataDir], { stdout: "ignore" });
      if ((await stop.exited) !== 0) throw new Error("The relay could not be stopped.");
    },
    explainFailure: () => undefined,
  };
}
