import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DiffFile } from "@agentcontrol/protocol";
import { git } from "../git/index.ts";
import { parseNameStatus, parseNumstat, zipFiles } from "./diff-parse.ts";

interface Diff {
  baseCommit: string;
  files: DiffFile[];
  patch: string;
}

async function diffAgainst(worktreePath: string, base: string, indexFile: string): Promise<Diff> {
  const options = { cwd: worktreePath, env: { GIT_INDEX_FILE: indexFile } };
  await git(["read-tree", "HEAD"], options);
  await git(["add", "-A"], options);
  const diff = (extra: string[]) => git(["diff", "--cached", "-M", ...extra, base], options);
  const [numstat, names, patch] = await Promise.all([
    diff(["--numstat", "-z"]),
    diff(["--name-status", "-z"]),
    diff([]),
  ]);
  const files = zipFiles(parseNameStatus(names), parseNumstat(numstat));
  return { baseCommit: base, files, patch };
}

/** Every change since the branch left its base, committed or not, untracked files included. */
export async function diffWorktree(options: {
  worktreePath: string;
  baseBranch: string;
}): Promise<Diff> {
  const cwd = options.worktreePath;
  const mergeBase = (await git(["merge-base", options.baseBranch, "HEAD"], { cwd })).trim();
  const dir = await mkdtemp(join(tmpdir(), "agentcontrol-index-"));
  try {
    return await diffAgainst(cwd, mergeBase, join(dir, "index"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
