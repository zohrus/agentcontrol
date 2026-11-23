/** True while the process runs. A process that ended but was not yet reaped (a zombie) is gone. */
export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  const state = Bun.spawnSync(["ps", "-o", "stat=", "-p", String(pid)])
    .stdout.toString()
    .trim();
  // `ps` printing nothing means the process was reaped between the two checks: it is gone.
  return state !== "" && !state.startsWith("Z");
}
