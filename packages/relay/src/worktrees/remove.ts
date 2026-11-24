import { randomUUID } from "node:crypto";
import { access, mkdir, readdir, readFile, realpath, rename, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { git } from "../git/index.ts";

/** A worktree that is no longer one: its folder waits, outside the worktrees, to be deleted. */
export interface Removal {
  /** True when a folder was moved aside and `finish` has files to delete; false when there is nothing to wait for. */
  pending: boolean;
  /** Deletes the moved folder. Slow for a big folder; nothing waits for it. */
  finish(): Promise<void>;
}

/** Where moved folders wait, next to the worktrees; the relay deletes what is left in it when it starts. */
const ASIDE = ".deleting";

const exists = (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  );

const nothingWaits: Removal = { pending: false, finish: () => Promise.resolve() };

/** The folder git keeps the worktrees' own data in: `<repo>/.git/worktrees`. */
async function adminRoot(repoPath: string): Promise<string> {
  const common = (await git(["rev-parse", "--git-common-dir"], { cwd: repoPath })).trim();
  return join(resolve(repoPath, common), "worktrees");
}

/** The ways the worktree's `.git` file can be spelled in git's record: as given, and with links resolved. */
async function spellings(worktreePath: string): Promise<string[]> {
  const real = await realpath(worktreePath).catch(() => worktreePath);
  return [...new Set([worktreePath, real])].map((path) => resolve(path, ".git"));
}

/**
 * The records git keeps for the worktree at this path (normally one), found by what they point to.
 * A record's `gitdir` file holds the worktree's `.git` path, absolute or (with
 * `worktree.useRelativePaths`) relative to the record itself.
 */
async function recordsOf(call: { repoPath: string; paths: string[] }): Promise<string[]> {
  const root = await adminRoot(call.repoPath);
  const names = await readdir(root).catch(() => [] as string[]);
  const found: string[] = [];
  for (const name of names) {
    const pointer = await readFile(join(root, name, "gitdir"), "utf8").catch(() => "");
    if (pointer.trim() === "") continue;
    if (call.paths.includes(resolve(join(root, name), pointer.trim())))
      found.push(join(root, name));
  }
  return found;
}

/** Forgets the worktree: only the records that point at its folder are deleted, never another worktree's. */
async function forget(records: string[]): Promise<void> {
  for (const record of records) await rm(record, { recursive: true, force: true });
}

function deletion(aside: string): Removal {
  return {
    pending: true,
    finish: async () => {
      await rm(aside, { recursive: true, force: true });
    },
  };
}

/** Renames the folder into `.deleting` next to it; where it went, or undefined when it could not be moved. */
async function moveAside(worktreePath: string): Promise<string | undefined> {
  const aside = join(dirname(worktreePath), ASIDE, `${basename(worktreePath)}-${randomUUID()}`);
  await mkdir(dirname(aside), { recursive: true });
  return rename(worktreePath, aside).then(
    () => aside,
    () => undefined,
  );
}

/** The old way, slow for a big folder: git deletes the folder and its record itself. */
async function removeInPlace(repoPath: string, worktreePath: string): Promise<Removal> {
  await git(["worktree", "remove", "--force", worktreePath], { cwd: repoPath });
  return nothingWaits;
}

/** The folder is gone already (moved by a relay that stopped, or by the user): only git's record is left to delete. */
async function forgetMissing(call: { repoPath: string; paths: string[] }): Promise<Removal> {
  // A repository that is gone has no records either.
  const records = await recordsOf(call).catch(() => [] as string[]);
  await forget(records);
  return nothingWaits;
}

/**
 * Removes the worktree without waiting for its folder to be deleted: the folder is renamed into
 * `.deleting` (the same file system, so at once) and git's record of it is deleted, which leaves
 * the branch and its commits exactly as they were. Deleting the moved folder is `finish`. If the
 * record cannot be deleted the folder is moved back, so nothing is half removed. A folder whose
 * record cannot be found, or that cannot be moved, is removed the slow way by git itself.
 */
export async function removeWorktree(options: {
  repoPath: string;
  worktreePath: string;
}): Promise<Removal> {
  const { repoPath, worktreePath } = options;
  const paths = await spellings(worktreePath);
  if (!(await exists(worktreePath))) return forgetMissing({ repoPath, paths });
  const records = await recordsOf({ repoPath, paths });
  const aside = records.length === 0 ? undefined : await moveAside(worktreePath);
  if (aside === undefined) return removeInPlace(repoPath, worktreePath);
  await forget(records).catch(async (error: unknown) => {
    await rename(aside, worktreePath);
    throw error;
  });
  return deletion(aside);
}

/** Deletes the folders an earlier relay moved aside and did not finish deleting. */
export async function sweepMovedWorktrees(worktreesDir: string): Promise<void> {
  await rm(join(worktreesDir, ASIDE), { recursive: true, force: true });
}
