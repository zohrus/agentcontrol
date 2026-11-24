import { tmpdir } from "node:os";
import { join } from "node:path";
import { git } from "./git.ts";
import { temporaryFolder } from "./release-folder.ts";

/**
 * Gives the repo a remote called origin (a bare repository on this machine) that holds its main
 * branch. Like a repo set up with `git remote add`, it has no `origin/HEAD`. Returns the remote.
 */
export async function givesTheRepoARemote(repoPath: string): Promise<string> {
  const remote = join(await temporaryFolder("agentcontrol-remote-"), "origin.git");
  await git(repoPath, "init", "--bare", "--initial-branch=main", remote);
  await git(repoPath, "remote", "add", "origin", remote);
  await git(repoPath, "push", "origin", "main");
  await git(repoPath, "fetch", "origin");
  return remote;
}

/** Someone else pushes a commit that adds `path` to the remote's main; the repo has not fetched it. */
export async function aTeammatePushesAFile(
  remote: string,
  file: { path: string; content: string },
): Promise<void> {
  const clone = join(await temporaryFolder("agentcontrol-teammate-"), "work");
  await git(tmpdir(), "clone", remote, clone);
  await git(clone, "config", "user.name", "Teammate");
  await git(clone, "config", "user.email", "teammate@example.com");
  await Bun.write(join(clone, file.path), file.content);
  await git(clone, "add", file.path);
  await git(clone, "commit", "-m", `Add ${file.path}`);
  await git(clone, "push", "origin", "main");
}

/** The repo hears about what is on its remote (`git fetch`), without changing its own branches. */
export async function theRepoFetchesItsRemote(repoPath: string): Promise<void> {
  await git(repoPath, "fetch", "origin");
}

/** The remote's address stops working, as when the computer is offline. */
export async function theRemoteCannotBeReached(repoPath: string): Promise<void> {
  await git(repoPath, "remote", "set-url", "origin", join(tmpdir(), "agentcontrol-no-such-remote"));
}

/** A remote that was never reachable: the repo knows its name but nothing of its branches. */
export async function givesTheRepoAnUnreachableRemote(repoPath: string): Promise<void> {
  const address = join(tmpdir(), "agentcontrol-no-such-remote");
  await git(repoPath, "remote", "add", "origin", address);
}
