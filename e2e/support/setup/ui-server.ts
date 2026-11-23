import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { onTestEnd } from "./cleanup.ts";

/**
 * Kills the process that runs the UI (Vite) for the app in this test process, as an out-of-memory
 * kill would. Only the children of this process are looked at, so parallel tests are not touched.
 */
export function theUiServerProcessIsKilled(): void {
  const found = Bun.spawnSync(["pgrep", "-P", String(process.pid), "-f", "ui-template/server.ts"]);
  const pid = Number(found.stdout.toString().split("\n")[0]);
  if (!pid) throw new Error("expected the app to have started a UI server process, but none runs");
  process.kill(pid, "SIGKILL");
}

/** A UI server that an earlier run of the app left running, and that the data folder remembers. */
export interface LeftoverUiServer {
  readonly exited: Promise<number>;
}

/**
 * Pretends that the previous run of the app (which `bun --watch` replaced in place, or which was
 * killed) left its UI server running: a process of that kind, named in the app's pid file.
 */
export async function aUiServerIsLeftRunning(app: { dataDir: string }): Promise<LeftoverUiServer> {
  const folder = await mkdtemp(join(tmpdir(), "agentcontrol-leftover-"));
  onTestEnd(() => rm(folder, { recursive: true, force: true }));
  const script = join(folder, "server.ts");
  await writeFile(script, "setInterval(() => undefined, 1000);\n");
  const leftover = Bun.spawn(["bun", script], { stdout: "ignore", stderr: "ignore" });
  onTestEnd(() => {
    leftover.kill();
    return leftover.exited;
  });
  await writeFile(join(app.dataDir, "ui-server.pid"), String(leftover.pid));
  return { exited: leftover.exited };
}
