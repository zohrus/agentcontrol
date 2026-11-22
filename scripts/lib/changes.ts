// What a branch changed compared with its base (committed, uncommitted and untracked).
import { readFileSync } from "node:fs";
import { git, gitLines } from "./proc.ts";

export function mergeBase(base = "origin/main"): string {
  const { ok, out } = git(["merge-base", base, "HEAD"]);
  if (!ok) throw new Error(`cannot find a merge base with ${base}: run git fetch origin main`);
  return out;
}

function untracked(): string[] {
  return gitLines(["ls-files", "--others", "--exclude-standard", "--full-name"]);
}

/** Every path that differs from the merge base (tracked changes plus untracked files). */
export function changedFiles(base: string): string[] {
  const tracked = gitLines(["diff", "--name-only", "--no-renames", base]);
  return [...new Set([...tracked, ...untracked()])].sort();
}

/** Paths that are new since the merge base (added or untracked). */
export function addedFiles(base: string): string[] {
  const added = gitLines(["diff", "--name-only", "--diff-filter=A", "--no-renames", base]);
  return [...new Set([...added, ...untracked()])].sort();
}

function readLines(path: string): string[] {
  try {
    return readFileSync(path, "utf8").split("\n");
  } catch {
    return [];
  }
}

/** Counts added lines matching `pattern`, over tracked changes and untracked files. */
export function countAddedLines(base: string, pattern: RegExp): number {
  const diff = git(["diff", "-U0", base]).out.split("\n");
  const inDiff = diff.filter((line) => line.startsWith("+") && !line.startsWith("+++ "));
  const inNew = untracked().flatMap(readLines);
  return [...inDiff, ...inNew].filter((line) => pattern.test(line)).length;
}

export function fileDiffers(base: string, path: string): boolean {
  return !git(["diff", "--quiet", base, "--", path]).ok;
}
