import type { CoverageConfig } from "./config.ts";
import type { NewLineCoverage } from "./diff.ts";
import { type FileCoverage, percentOf, type Ratio, ratioOf } from "./measure.ts";
import type { Sources } from "./sources.ts";

const describe = (ratio: Ratio) => ({ ...ratio, percent: percentOf(ratio) });

/** The machine-readable result for the status page and for `coverage-stable.ts`. */
export async function writeSummary(options: {
  config: CoverageConfig;
  sources: Sources;
  files: FileCoverage[];
  fresh: NewLineCoverage;
  packages: Map<string, Ratio>;
}): Promise<void> {
  const { config, sources, files, fresh, packages } = options;
  const summary = {
    total: describe(ratioOf(files)),
    thresholds: config.thresholds,
    packages: Object.fromEntries([...packages].map(([name, ratio]) => [name, describe(ratio)])),
    files: Object.fromEntries(files.map((file) => [file.file, describe(ratioOf([file]))])),
    newLines: { ...describe(fresh), uncovered: fresh.uncovered },
    pending: sources.pending.map(({ file, entry }) => ({ file, ...entry })),
    excluded: sources.excluded.map(({ path, reason }) => ({ path, reason })),
  };
  await Bun.write("coverage/summary.json", `${JSON.stringify(summary, null, 2)}\n`);
  const coveredLines = Object.fromEntries(
    files.map((file) => [file.file, [...file.covered].sort((a, b) => a - b)]),
  );
  await Bun.write("coverage/covered-lines.json", `${JSON.stringify(coveredLines, null, 1)}\n`);
}
