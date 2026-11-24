import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

async function git(cwd: string, ...args: string[]): Promise<void> {
  await Bun.spawn(["git", ...args], { cwd, stdout: "ignore", stderr: "ignore" }).exited;
}

/**
 * Makes every git command that talks to `origin` take `latencyMs` longer, as a connection over the
 * internet does before it says anything (ssh and TLS set-up). The remote stays a local bare repository.
 */
export async function givesTheRemoteLatency(call: {
  repoPath: string;
  remote: string;
  latencyMs: number;
}): Promise<void> {
  const { repoPath, remote, latencyMs } = call;
  const folder = await mkdtemp(join(tmpdir(), "agentcontrol-slow-remote-"));
  const wrapper = join(folder, "ssh.sh");
  const seconds = (latencyMs / 1000).toFixed(3);
  await Bun.write(wrapper, `sleep ${seconds}\nfor last; do :; done\nexec sh -c "$last"\n`);
  await git(repoPath, "config", "ssh.variant", "ssh");
  await git(repoPath, "config", "core.sshCommand", `sh ${wrapper}`);
  await git(repoPath, "remote", "set-url", "origin", `ssh://localhost${remote}`);
}
