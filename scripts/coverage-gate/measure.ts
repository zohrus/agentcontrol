import { guessExecutableLines } from "./executable.ts";
import type { LcovFiles } from "./lcov.ts";

export interface FileCoverage {
  file: string;
  /** The package folder, e.g. `relay`. */
  pkg: string;
  /** Lines that can run. */
  executable: number[];
  /** Lines that ran in at least one end-to-end run. */
  covered: Set<number>;
}

export interface Ratio {
  covered: number;
  lines: number;
}

export const percentOf = ({ covered, lines }: Ratio): number =>
  lines === 0 ? 100 : (covered / lines) * 100;

export const ratioOf = (files: FileCoverage[]): Ratio => ({
  covered: files.reduce((sum, file) => sum + file.covered.size, 0),
  lines: files.reduce((sum, file) => sum + file.executable.length, 0),
});

/** Coverage of one file. A file no test loaded has no report, so it counts as fully uncovered. */
async function measureFile(file: string, merged: LcovFiles): Promise<FileCoverage> {
  const hits = merged.get(file);
  const pkg = file.split("/")[1] ?? "";
  if (hits === undefined) {
    return { file, pkg, executable: await guessExecutableLines(file), covered: new Set() };
  }
  const executable = [...hits.keys()].sort((a, b) => a - b);
  const covered = new Set(executable.filter((line) => (hits.get(line) ?? 0) > 0));
  return { file, pkg, executable, covered };
}

export function measureFiles(files: string[], merged: LcovFiles): Promise<FileCoverage[]> {
  return Promise.all(files.map((file) => measureFile(file, merged)));
}

/** The merged lcov restricted to the given files, so the artifact matches what the gate counted. */
export function lcovOf(files: FileCoverage[], merged: LcovFiles): LcovFiles {
  const kept: LcovFiles = new Map();
  for (const { file, executable } of files) {
    kept.set(file, merged.get(file) ?? new Map(executable.map((line) => [line, 0])));
  }
  return kept;
}

export function byPackage(files: FileCoverage[]): Map<string, Ratio> {
  const names = [...new Set(files.map((file) => file.pkg))].sort();
  return new Map(names.map((name) => [name, ratioOf(files.filter((file) => file.pkg === name))]));
}
