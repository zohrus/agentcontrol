import type { DiffFile } from "@agentcontrol/protocol";

type Status = DiffFile["status"];

interface NameEntry {
  path: string;
  status: Status;
}
interface CountEntry {
  additions: number;
  deletions: number;
}

const TWO_PATHS = new Set(["R", "C"]);

const STATUS: Record<string, Status> = {
  A: "added",
  C: "added",
  D: "deleted",
  R: "renamed",
  M: "modified",
  T: "modified",
};

function nameEntry(tokens: string[], i: number): { entry: NameEntry; next: number } {
  const code = (tokens[i] ?? "").charAt(0);
  const width = TWO_PATHS.has(code) ? 3 : 2;
  const path = tokens[i + width - 1] ?? "";
  return { entry: { path, status: STATUS[code] ?? "modified" }, next: i + width };
}

/** Parses `git diff --name-status -z`; renames and copies carry two paths (old, new). */
export function parseNameStatus(output: string): NameEntry[] {
  const tokens = output.split("\0");
  const entries: NameEntry[] = [];
  let i = 0;
  while (i < tokens.length - 1) {
    const { entry, next } = nameEntry(tokens, i);
    entries.push(entry);
    i = next;
  }
  return entries;
}

function count(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) ? n : 0;
}

/** Parses `git diff --numstat -z`; binary files show "-" and count as 0. */
export function parseNumstat(output: string): CountEntry[] {
  const tokens = output.split("\0");
  const entries: CountEntry[] = [];
  let i = 0;
  while (i < tokens.length - 1) {
    const [additions, deletions, path] = (tokens[i] ?? "").split("\t");
    entries.push({ additions: count(additions), deletions: count(deletions) });
    i += path === "" ? 3 : 1;
  }
  return entries;
}

/** Joins the two parallel lists (git prints both in the same order). */
export function zipFiles(names: NameEntry[], counts: CountEntry[]): DiffFile[] {
  return names.map((name, index) => ({
    ...name,
    additions: counts[index]?.additions ?? 0,
    deletions: counts[index]?.deletions ?? 0,
  }));
}
