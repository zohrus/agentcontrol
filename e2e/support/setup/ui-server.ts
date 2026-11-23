import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

/**
 * From now on (until the test ends) the app's UI server is a program that prints where it
 * listens and then ignores SIGTERM, the signal that asks a server to quit.
 */
export async function theUiServerIgnoresTheQuitSignal(): Promise<void> {
  const folder = await mkdtemp(join(tmpdir(), "agentcontrol-stubborn-"));
  onTestEnd(() => rm(folder, { recursive: true, force: true }));
  await mkdir(join(folder, "ui-template"));
  await writeFile(join(folder, "ui-template", "package.json"), "{}\n");
  const lines = ['process.on("SIGTERM", () => undefined);', "console.log('{\"port\":1}');"];
  const stubborn = `${lines.join("\n")}\nsetInterval(() => undefined, 1000);\n`;
  await writeFile(join(folder, "ui-template", "server.ts"), stubborn);
  const before = process.env["AGENTCONTROL_RESOURCES"];
  process.env["AGENTCONTROL_RESOURCES"] = folder;
  onTestEnd(() => {
    if (before === undefined) delete process.env["AGENTCONTROL_RESOURCES"];
    else process.env["AGENTCONTROL_RESOURCES"] = before;
    return Promise.resolve();
  });
}

/** The process id the app recorded for the process that serves its UI. */
export async function theUiServerProcessOf(app: { dataDir: string }): Promise<number> {
  return Number(await readFile(join(app.dataDir, "ui-server.pid"), "utf8"));
}
