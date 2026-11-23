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
