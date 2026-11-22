import { dirname } from "node:path";
import type { FsEntry as FsEntrySchema } from "@agentcontrol/protocol";
import type { z } from "zod";
import { git, parseStatus } from "../git/index.ts";

type FsEntry = z.infer<typeof FsEntrySchema>;

function directoriesOf(paths: string[]): string[] {
  const dirs = new Set<string>();
  for (const path of paths) {
    for (let dir = dirname(path); dir !== "."; dir = dirname(dir)) dirs.add(dir);
  }
  return [...dirs];
}

/** Tracked and untracked files (minus .gitignore), plus their folders, with git status. */
export async function fileTree(worktreePath: string): Promise<{ entries: FsEntry[] }> {
  const cwd = worktreePath;
  const listed = await git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd,
  });
  const status = parseStatus(await git(["status", "--porcelain=v1", "-z", "-uall"], { cwd }));
  const statusOf = new Map(status.map((entry) => [entry.path, entry.status]));
  const files = listed.split("\0").filter((path) => path !== "" && statusOf.get(path) !== "D");
  const fileEntries = files.map((path): FsEntry => {
    const gitStatus = statusOf.get(path);
    return gitStatus === undefined ? { path, kind: "file" } : { path, kind: "file", gitStatus };
  });
  const dirEntries = directoriesOf(files).map((path): FsEntry => ({ path, kind: "dir" }));
  return { entries: [...dirEntries, ...fileEntries].sort((a, b) => a.path.localeCompare(b.path)) };
}
