import { type FileCoverage, type Ratio } from "./measure.ts";

/** File to the line numbers added or changed. */
export type AddedLines = Map<string, Set<number>>;

function git(args: string[]): { ok: boolean; text: string } {
  const run = Bun.spawnSync(["git", ...args], { stdout: "pipe", stderr: "pipe" });
  return { ok: run.exitCode === 0, text: run.stdout.toString().trim() };
}

/** The commit the work started from: where this branch left `origin/main`. */
export function baseCommit(): string | undefined {
  const base = git(["merge-base", "origin/main", "HEAD"]);
  return base.ok ? base.text : undefined;
}

const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

/** The new-side line numbers of a hunk header, or none for any other row. */
function hunkLines(row: string): number[] {
  const hunk = HUNK.exec(row);
  const start = Number(hunk?.[1] ?? 0);
  const count = hunk ? Number(hunk[2] ?? 1) : 0;
  return Array.from({ length: count }, (_, index) => start + index);
}

/** Reads `git diff -U0` output: the new-side line numbers of every hunk, per file. */
function parseAddedLines(diff: string): AddedLines {
  const added: AddedLines = new Map();
  let lines = new Set<number>();
  for (const row of diff.split("\n")) {
    if (row.startsWith("+++ ")) {
      lines = new Set();
      added.set(row.slice(6), lines);
    } else {
      hunkLines(row).forEach((line) => lines.add(line));
    }
  }
  added.delete("/dev/null");
  return added;
}

async function wholeFiles(paths: string[]): Promise<AddedLines> {
  const entries = await Promise.all(
    paths.map(async (path) => {
      const total = (await Bun.file(path).text()).split("\n").length;
      return [path, new Set(Array.from({ length: total }, (_, index) => index + 1))] as const;
    }),
  );
  return new Map(entries);
}

/** Lines added or changed since `base`, including files git does not know yet. */
export async function linesChangedSince(base: string): Promise<AddedLines> {
  const diff = git(["diff", "-U0", "--no-color", "--no-ext-diff", base, "--", "packages"]);
  const untracked = git(["ls-files", "--others", "--exclude-standard", "--", "packages"]);
  const fresh = await wholeFiles(untracked.text === "" ? [] : untracked.text.split("\n"));
  return new Map([...parseAddedLines(diff.text), ...fresh]);
}

export interface NewLineCoverage extends Ratio {
  /** `file:line` of every added executable line that no test ran. */
  uncovered: string[];
}

/** Coverage of just the added lines that can run; comments and blank lines are not counted. */
export function coverageOfNewLines(files: FileCoverage[], added: AddedLines): NewLineCoverage {
  const uncovered: string[] = [];
  let lines = 0;
  for (const { file, executable, covered } of files) {
    const wanted = executable.filter((line) => added.get(file)?.has(line));
    lines += wanted.length;
    uncovered.push(
      ...wanted.filter((line) => !covered.has(line)).map((n) => `${file}:${String(n)}`),
    );
  }
  return { lines, covered: lines - uncovered.length, uncovered };
}
