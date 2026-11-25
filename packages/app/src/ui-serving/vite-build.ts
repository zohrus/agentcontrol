import { join } from "node:path";

const BUILD_TIMEOUT_MS = 5 * 60_000;

/** The Vite builds that are running, so that quitting the app can end them. */
export type RunningBuilds = Set<Bun.Subprocess>;

/**
 * Builds the UI project in `dir` into `outDir` with the Vite of the project's own node_modules,
 * run through the current Bun binary (a release has no node). NODE_ENV is set here, because the
 * app may have been started by a test runner or a launcher that sets it to something else. The
 * "runner" config loader writes no temporary file into the (shared, signed) node_modules.
 */
export async function viteBuild(options: {
  dir: string;
  outDir: string;
  running: RunningBuilds;
}): Promise<{ ok: boolean; output: string }> {
  const vite = join(options.dir, "node_modules", "vite", "bin", "vite.js");
  const args = ["build", "--configLoader", "runner", "--outDir", options.outDir, "--emptyOutDir"];
  const child = Bun.spawn([process.execPath, vite, ...args], {
    cwd: options.dir,
    env: { ...process.env, BUN_BE_BUN: "1", NODE_ENV: "production" },
    stdout: "pipe",
    stderr: "pipe",
    timeout: BUILD_TIMEOUT_MS,
  });
  options.running.add(child);
  const [out, err, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  options.running.delete(child);
  return { ok: exitCode === 0, output: out + err };
}
