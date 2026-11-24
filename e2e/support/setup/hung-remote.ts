import { join } from "node:path";
import { git } from "./git.ts";
import { givesTheRepoARemote } from "./repo-remote.ts";
import { temporaryFolder } from "./release-folder.ts";

/** A remote that answers only when the test lets it, as a network that hangs does. */
export interface HungRemote {
  /** The remote answers from now on (what was waiting goes on, nothing waits again). */
  answers(): Promise<void>;
}

/**
 * Gives the repo an `origin` that every git command reaches through a command that waits for the
 * test's go-ahead first, so fetching and `ls-remote` hang until `answers()`.
 */
export async function givesTheRepoARemoteThatHangs(repoPath: string): Promise<HungRemote> {
  const remote = await givesTheRepoARemote(repoPath);
  const folder = await temporaryFolder("agentcontrol-hung-remote-");
  const signal = join(folder, "answers");
  const wrapper = join(folder, "ssh.sh");
  const script = [
    `while [ ! -e '${signal}' ]; do sleep 0.05; done`,
    "for last; do :; done",
    'exec sh -c "$last"',
  ].join("\n");
  await Bun.write(wrapper, script);
  await git(repoPath, "config", "ssh.variant", "ssh");
  await git(repoPath, "config", "core.sshCommand", `sh ${wrapper}`);
  await git(repoPath, "remote", "set-url", "origin", `ssh://localhost${remote}`);
  return {
    answers: async () => {
      await Bun.write(signal, "");
    },
  };
}
