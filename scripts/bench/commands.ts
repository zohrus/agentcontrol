import { rename, rm } from "node:fs/promises";
import { join } from "node:path";

export interface Timing {
  name: string;
  ms: number;
}

/** Where the repository is, where to make a scratch worktree, and the command that fills it as the setup script does. */
export interface Scene {
  repoPath: string;
  scratch: string;
  makeModules: string[];
}

async function run(cwd: string, command: string[]): Promise<void> {
  const proc = Bun.spawn(command, { cwd, stdout: "pipe", stderr: "pipe" });
  const [, , code] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
  if (code !== 0) throw new Error(`${command.join(" ")} failed in ${cwd}`);
}

type Step = { name: string; work: () => Promise<unknown> };

async function timeAll(steps: Step[]): Promise<Timing[]> {
  const timings: Timing[] = [];
  for (const { name, work } of steps) {
    const start = performance.now();
    await work();
    timings.push({ name, ms: Math.round(performance.now() - start) });
  }
  return timings;
}

/**
 * What each command costs on its own, on the same repository: the ones the relay runs to start and
 * archive a session, run by hand one after the other with nothing else going on.
 */
export async function commandTimings(scene: Scene): Promise<Timing[]> {
  const folder = join(scene.scratch, "by-hand");
  const aside = `${folder}.deleting`;
  const git = (...args: string[]) => run(scene.repoPath, ["git", ...args]);
  const refspec = "+refs/heads/main:refs/remotes/origin/main";
  const timings = await timeAll([
    {
      name: "git ls-remote --symref origin HEAD",
      work: () => git("ls-remote", "--symref", "origin", "HEAD"),
    },
    { name: "git fetch origin main (nothing new)", work: () => git("fetch", "origin", refspec) },
    {
      name: "git worktree add (full checkout, one core)",
      work: () => git("worktree", "add", "--no-track", "-b", "by-hand", folder, "origin/main"),
    },
    { name: "setup script (makes node_modules)", work: () => run(folder, scene.makeModules) },
    {
      name: "git status --porcelain -uall",
      work: () => run(folder, ["git", "status", "--porcelain=v1", "-z", "-uall"]),
    },
    { name: "rename the folder aside", work: () => rename(folder, aside) },
    { name: "git worktree prune", work: () => git("worktree", "prune") },
    {
      name: "delete the moved folder (rm -rf)",
      work: () => rm(aside, { recursive: true, force: true }),
    },
  ]);
  await git("branch", "-D", "by-hand");
  return timings;
}

/** The same worktree removed the way the relay did before: `git worktree remove --force`. */
export async function removeTiming(scene: Scene): Promise<Timing> {
  const folder = join(scene.scratch, "by-hand-remove");
  const git = (...args: string[]) => run(scene.repoPath, ["git", ...args]);
  await git("worktree", "add", "--no-track", "-b", "by-hand-remove", folder, "origin/main");
  await run(folder, scene.makeModules);
  const [timing] = await timeAll([
    {
      name: "git worktree remove --force (the old archive)",
      work: () => git("worktree", "remove", "--force", folder),
    },
  ]);
  await git("branch", "-D", "by-hand-remove");
  return timing ?? { name: "git worktree remove --force", ms: 0 };
}
