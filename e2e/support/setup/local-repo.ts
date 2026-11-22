import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { onTestEnd } from "./cleanup.ts";
import { git } from "./git.ts";

/** A temporary git repo with one commit on `main` and an ignored `.env` file that worktrees copy. */
export async function createLocalRepo(): Promise<string> {
  const path = await realpath(await mkdtemp(join(tmpdir(), "agentcontrol-repo-")));
  onTestEnd(() => rm(path, { recursive: true, force: true }));
  await git(path, "init", "--initial-branch=main");
  await git(path, "config", "user.name", "Test User");
  await git(path, "config", "user.email", "test@example.com");
  await Bun.write(join(path, "README.md"), "# Demo\n");
  await Bun.write(join(path, ".gitignore"), ".env\n");
  await Bun.write(join(path, ".env"), "SECRET=1\n");
  await git(path, "add", "README.md", ".gitignore");
  await git(path, "commit", "-m", "Initial commit");
  return path;
}
