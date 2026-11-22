import { Glob } from "bun";
import type { CoverageConfig, PendingEntry } from "./config.ts";

export interface PendingFile {
  file: string;
  entry: PendingEntry;
}

export interface Sources {
  /** Files whose lines count toward the totals. */
  counted: string[];
  /** Every exclusion with the files it removed. */
  excluded: Array<{ path: string; reason: string; files: string[] }>;
  pending: PendingFile[];
  /** Entries that match no file: they must be deleted, so the lists stay honest. */
  stale: string[];
}

function listSourceFiles(include: string[]): string[] {
  const found = include.flatMap((pattern) => [...new Glob(pattern).scanSync({ cwd: "." })]);
  return [...new Set(found)].filter((file) => !file.endsWith(".d.ts")).sort();
}

const matching = (files: string[], pattern: string): string[] => {
  const glob = new Glob(pattern);
  return files.filter((file) => glob.match(file));
};

/** Splits the source tree into counted, excluded (with reasons) and pending files. */
export function classifySources(config: CoverageConfig): Sources {
  const all = listSourceFiles(config.include);
  const excluded = config.exclude.map((entry) => ({ ...entry, files: matching(all, entry.path) }));
  const pending = config.pending.flatMap((entry) =>
    matching(all, entry.path).map((file) => ({ file, entry })),
  );
  const skipped = new Set([...excluded.flatMap((e) => e.files), ...pending.map((p) => p.file)]);
  const stale = [
    ...excluded.filter((e) => e.files.length === 0).map((e) => e.path),
    ...config.pending.filter((p) => matching(all, p.path).length === 0).map((p) => p.path),
  ];
  return { counted: all.filter((file) => !skipped.has(file)), excluded, pending, stale };
}
