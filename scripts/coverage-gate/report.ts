import type { CoverageConfig } from "./config.ts";
import type { NewLineCoverage } from "./diff.ts";
import { byPackage, type FileCoverage, percentOf, ratioOf } from "./measure.ts";
import type { Sources } from "./sources.ts";

const fixed = (value: number): string => value.toFixed(2);

function fileRow(file: FileCoverage): string {
  const ratio = ratioOf([file]);
  const counts = `${String(ratio.covered)}/${String(ratio.lines)}`;
  return `${fixed(percentOf(ratio)).padStart(7)}%  ${counts.padStart(9)}  ${file.file}`;
}

/** Every file below 100%, worst first; fully covered files are only counted. */
export function printTable(files: FileCoverage[]): void {
  const partial = files
    .filter((file) => file.covered.size < file.executable.length)
    .sort(
      (a, b) => percentOf(ratioOf([a])) - percentOf(ratioOf([b])) || a.file.localeCompare(b.file),
    );
  console.log("\nLine coverage by file, worst first (files at 100% are left out)");
  partial.forEach((file) => {
    console.log(fileRow(file));
  });
  console.log(`${String(files.length - partial.length)} of ${String(files.length)} files at 100%`);
}

export function printPackages(files: FileCoverage[]): void {
  console.log("\nBy package");
  byPackage(files).forEach((ratio, name) => {
    console.log(`${fixed(percentOf(ratio)).padStart(7)}%  ${name}`);
  });
}

/** Loud on every run: these features have no caller yet, so their lines are left out for now. */
export function printPending(sources: Sources): void {
  if (sources.pending.length === 0) return;
  const bar = "!".repeat(72);
  console.log(`\n${bar}\nPENDING: left out of the total until someone wires them in (TEMPORARY)`);
  const seen = new Set<string>();
  for (const { file, entry } of sources.pending) {
    const first = !seen.has(entry.path);
    seen.add(entry.path);
    if (first) {
      console.log(`  ${entry.path}\n    owner: ${entry.owner}\n    since: ${entry.since}`);
      console.log(`    why:   ${entry.reason}`);
    }
    console.log(`      ${file}`);
  }
  console.log(`${bar}\n`);
}

export function printVerdict(options: {
  config: CoverageConfig;
  total: number;
  fresh: NewLineCoverage;
  base: string | undefined;
}): boolean {
  const { config, total, fresh, base } = options;
  const { totalLines, newLines } = config.thresholds;
  const freshPercent = percentOf(fresh);
  const baseNote = base === undefined ? " (origin/main not found: nothing to compare with)" : "";
  console.log(`\nTotal line coverage: ${fixed(total)}% (needs ${String(totalLines)}%)`);
  console.log(
    `New or changed lines: ${fixed(freshPercent)}% of ${String(fresh.lines)} (needs ${String(newLines)}%)${baseNote}`,
  );
  fresh.uncovered.forEach((spot) => {
    console.log(`  not run by any end-to-end test: ${spot}`);
  });
  return total >= totalLines && freshPercent >= newLines;
}
