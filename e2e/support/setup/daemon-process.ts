import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { onTestEnd } from "./cleanup.ts";

const relayMain = join(import.meta.dir, "../../../packages/relay/src/main.ts");

/** A relay data folder and what a person types to stop the relay that lives in it. */
export interface DaemonFolder {
  readonly dataDir: string;
  /** Runs `main.ts stop --data-dir <dir>` as a person would, and reports how it ended. */
  stopsIt(): Promise<{ exitCode: number; output: string }>;
  /** True while the process with this id (the relay's) is running. */
  isRunning(pid: number): boolean;
}

async function waitForSocket(dataDir: string): Promise<void> {
  const socket = join(dataDir, "relay.sock");
  for (let waited = 0; !existsSync(socket); waited += 50) {
    if (waited > 10_000) throw new Error("the relay daemon did not start listening in time");
    await Bun.sleep(50);
  }
}

/** A fresh data folder; nothing runs in it yet. */
export async function aRelayFolder(): Promise<DaemonFolder> {
  const dataDir = await mkdtemp(join(tmpdir(), "agentcontrol-daemon-"));
  onTestEnd(() => rm(dataDir, { recursive: true, force: true }));
  return {
    dataDir,
    stopsIt: async () => {
      const run = Bun.spawn(["bun", relayMain, "stop", "--data-dir", dataDir], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const [out, err, exitCode] = await Promise.all([
        run.stdout.text(),
        run.stderr.text(),
        run.exited,
      ]);
      return { exitCode, output: out + err };
    },
    isRunning: (pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** Starts the relay daemon as its own process in the folder; returns its process id. */
export async function aRelayRunsIn(folder: DaemonFolder): Promise<number> {
  const daemon = Bun.spawn(["bun", relayMain, "daemon", "--data-dir", folder.dataDir], {
    stdout: "ignore",
    stderr: "inherit",
  });
  onTestEnd(() => {
    daemon.kill("SIGKILL");
    return Promise.resolve();
  });
  await waitForSocket(folder.dataDir);
  return daemon.pid;
}

/** Writes a relay.pid naming a process that ignores the request to stop. */
export async function aRelayThatIgnoresStopRunsIn(folder: DaemonFolder): Promise<number> {
  const stubborn = Bun.spawn(
    ["bun", "-e", "process.on('SIGTERM', () => undefined); setInterval(() => undefined, 1000);"],
    { stdout: "ignore", stderr: "inherit" },
  );
  onTestEnd(() => {
    stubborn.kill("SIGKILL");
    return Promise.resolve();
  });
  await Bun.write(join(folder.dataDir, "relay.pid"), String(stubborn.pid));
  await Bun.sleep(300);
  return stubborn.pid;
}
