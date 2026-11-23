import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { onTestEnd } from "./cleanup.ts";
import { git } from "./git.ts";

/** Writes `count` small files under `files/` and returns their paths in the repo. */
async function writeManyFiles(repo: string, count: number): Promise<string[]> {
  const files = Array.from({ length: count }, (_, index) => `files/file-${String(index)}.txt`);
  await Promise.all(files.map((file) => Bun.write(join(repo, file), `${file}\n`)));
  return files;
}

/**
 * A temporary git repo with one commit on `main` and an ignored `.env` file that worktrees copy.
 * `extraFiles` adds that many small files under `files/`, so the repo has a lot of them.
 */
export async function createLocalRepo(options: { extraFiles?: number } = {}): Promise<string> {
  const path = await realpath(await mkdtemp(join(tmpdir(), "agentcontrol-repo-")));
  onTestEnd(() => rm(path, { recursive: true, force: true }));
  await git(path, "init", "--initial-branch=main");
  await git(path, "config", "user.name", "Test User");
  await git(path, "config", "user.email", "test@example.com");
  await Bun.write(join(path, "README.md"), "# Demo\n");
  await Bun.write(join(path, ".gitignore"), ".env\n");
  await Bun.write(join(path, ".env"), "SECRET=1\n");
  const extra = await writeManyFiles(path, options.extraFiles ?? 0);
  await git(path, "add", "README.md", ".gitignore", ...extra);
  await git(path, "commit", "-m", "Initial commit");
  return path;
}
