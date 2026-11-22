// `bun run integrate <branch> [--dry-run]`: the local merge queue. There are no pull requests;
// this is the only way work reaches main.
//
//   1. fetch origin/main, make a scratch worktree, rebase <branch> onto origin/main there
//      (a conflict stops everything with the conflicting files, nothing is pushed);
//   2. `bun install --frozen-lockfile` and the full `bun run check` in the scratch worktree;
//   3. only when green: append sha, branch and seconds to docs/landings.log and
//      `git push origin HEAD:main` (a fast-forward; rejected if main moved, so run it again).
//
// One landing at a time: a lock file in the git directory. --dry-run does everything except push.
//
// REVERT FIRST: if main is ever red, whoever sees it reverts the offending commit
// (`git revert <sha>`, then `bun run integrate` that revert) before doing anything else.
// Nobody builds on a red main; the fix goes through this script like any other change.
import {
  appendFileSync,
  linkSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { git, gitLines, runLive } from "./lib/proc.ts";

const NO_HOOKS = { LEFTHOOK: "0" };

/** Throws, so the `finally` in main still removes the scratch worktree and the lock. */
function fail(message: string): never {
  throw new Error(message);
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function lockHolder(lockPath: string): number {
  try {
    return Number(readFileSync(lockPath, "utf8"));
  } catch {
    return 0;
  }
}

/** Atomic: the pid is written to a private file, then hard-linked into place (fails if taken). */
function takeLock(lockPath: string): void {
  const mine = `${lockPath}.${String(process.pid)}`;
  writeFileSync(mine, String(process.pid));
  try {
    linkSync(mine, lockPath);
  } catch {
    const holder = lockHolder(lockPath);
    if (holder > 0 && processAlive(holder))
      fail(`another landing is running (pid ${String(holder)})`);
    rmSync(lockPath, { force: true });
    linkSync(mine, lockPath);
  } finally {
    rmSync(mine, { force: true });
  }
}

function conflictMessage(scratch: string, branch: string): string {
  const files = gitLines(["diff", "--name-only", "--diff-filter=U"], { cwd: scratch });
  git(["rebase", "--abort"], { cwd: scratch });
  return `${branch} conflicts with origin/main in:\n  ${files.join("\n  ")}\nRebase it yourself, then run integrate again.`;
}

function rebase(scratch: string, branch: string): void {
  const checkout = git(["checkout", "--detach", branch], { cwd: scratch });
  if (!checkout.ok) fail(`cannot check out ${branch}: ${checkout.out}`);
  const result = git(["rebase", "origin/main"], { cwd: scratch });
  if (!result.ok) fail(conflictMessage(scratch, branch));
}

async function verify(scratch: string): Promise<number> {
  const install = await runLive(["bun", "install", "--frozen-lockfile"], {
    cwd: scratch,
    env: NO_HOOKS,
  });
  if (install !== 0) fail("bun install --frozen-lockfile failed (is bun.lock out of date?)");
  return runLive(["bun", "run", "check"], { cwd: scratch });
}

function recordLanding(scratch: string, branch: string, seconds: number): void {
  const sha = git(["rev-parse", "--short", "HEAD"], { cwd: scratch }).out;
  const line = `${new Date().toISOString()} ${sha} ${branch} ${seconds.toFixed(0)}s\n`;
  appendFileSync(join(scratch, "docs/landings.log"), line);
  const added = git(["add", "docs/landings.log"], { cwd: scratch });
  const message = `Landing log: ${branch} at ${sha}`;
  const commit = git(["commit", "-m", message], { cwd: scratch, env: NO_HOOKS });
  if (!added.ok || !commit.ok) fail(`cannot record the landing: ${commit.out}`);
}

function land(scratch: string, dryRun: boolean): void {
  if (dryRun) {
    console.log("integrate: --dry-run, not pushing");
    return;
  }
  const push = git(["push", "origin", "HEAD:main"], { cwd: scratch, env: NO_HOOKS });
  if (!push.ok) fail(`push rejected (main moved?). Run integrate again.\n${push.out}`);
  console.log("integrate: pushed to origin/main");
}

async function integrate(branch: string, dryRun: boolean, scratch: string): Promise<void> {
  const started = performance.now();
  rebase(scratch, branch);
  if ((await verify(scratch)) !== 0) fail("check failed; nothing was pushed");
  recordLanding(scratch, branch, (performance.now() - started) / 1000);
  land(scratch, dryRun);
}

function lockFile(): string {
  const repo = git(["rev-parse", "--show-toplevel"]).out;
  return resolve(
    repo,
    git(["rev-parse", "--path-format=absolute", "--git-common-dir"]).out,
    "integrate.lock",
  );
}

async function inScratchWorktree(branch: string, dryRun: boolean): Promise<void> {
  const scratch = mkdtempSync(join(tmpdir(), "ac-integrate-"));
  try {
    const fetch = git(["fetch", "origin", "main"]);
    if (!fetch.ok) fail(`cannot fetch origin main: ${fetch.out}`);
    const added = git(["worktree", "add", "--detach", scratch, "origin/main"]);
    if (!added.ok) fail(`cannot create the scratch worktree: ${added.out}`);
    await integrate(branch, dryRun, scratch);
  } finally {
    git(["worktree", "remove", "--force", scratch]);
    rmSync(scratch, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const branch = args.find((arg) => !arg.startsWith("--"));
  if (branch === undefined) fail("usage: bun run integrate <branch> [--dry-run]");
  const lockPath = lockFile();
  takeLock(lockPath);
  try {
    await inScratchWorktree(branch, args.includes("--dry-run"));
  } finally {
    rmSync(lockPath, { force: true });
  }
}

try {
  await main();
} catch (error) {
  console.error(`integrate: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
