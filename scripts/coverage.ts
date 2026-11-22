// The coverage gate. Runs the end-to-end suite with coverage, merges every file's report and fails
// when too little of the product code ran, in total or in the lines this branch added.
// `--report-only` skips the run and reads what `coverage/parts` already holds.
// Exit codes: 0 gate passed, 1 gate failed, 2 the end-to-end suite itself failed.
import { mkdirSync } from "node:fs";
import { type CoverageConfig, readCoverageConfig } from "./coverage-gate/config.ts";
import {
  type AddedLines,
  baseCommit,
  coverageOfNewLines,
  linesChangedSince,
} from "./coverage-gate/diff.ts";
import { formatLcov, readParts } from "./coverage-gate/lcov.ts";
import { byPackage, lcovOf, measureFiles, percentOf, ratioOf } from "./coverage-gate/measure.ts";
import { printPackages, printPending, printTable, printVerdict } from "./coverage-gate/report.ts";
import { classifySources, type Sources } from "./coverage-gate/sources.ts";
import { writeSummary } from "./coverage-gate/summary.ts";

const PARTS_DIR = "coverage/parts";
const EXIT_TESTS_FAILED = 2;

async function runSuite(): Promise<void> {
  const run = Bun.spawn(["bun", "scripts/run-e2e.ts", "--coverage"], {
    stdout: "inherit",
    stderr: "inherit",
  });
  if ((await run.exited) !== 0) process.exit(EXIT_TESTS_FAILED);
}

async function addedLines(base: string | undefined): Promise<AddedLines> {
  return base === undefined ? new Map<string, Set<number>>() : linesChangedSince(base);
}

/** Reads the reports, measures every counted file and writes the artifacts. */
async function measureAndWrite(config: CoverageConfig, sources: Sources) {
  const merged = await readParts(PARTS_DIR);
  const files = await measureFiles(sources.counted, merged);
  const base = baseCommit();
  const fresh = coverageOfNewLines(files, await addedLines(base));
  mkdirSync("coverage", { recursive: true });
  await Bun.write("coverage/lcov.info", formatLcov(lcovOf(files, merged)));
  await writeSummary({ config, sources, files, fresh, packages: byPackage(files) });
  return { files, fresh, base };
}

/** Why the gate cannot run at all, if it cannot. */
function problemWith(sources: Sources): string | undefined {
  if (sources.stale.length > 0) {
    return `coverage.config.json lists files that do not exist: ${sources.stale.join(", ")}`;
  }
  return baseCommit() === undefined
    ? "origin/main is unknown, so new lines cannot be told apart: run `git fetch origin main`."
    : undefined;
}

async function main(): Promise<boolean> {
  if (!process.argv.includes("--report-only")) await runSuite();
  const config = await readCoverageConfig();
  const sources = classifySources(config);
  const problem = problemWith(sources);
  if (problem !== undefined) {
    console.log(problem);
    return false;
  }
  const { files, fresh, base } = await measureAndWrite(config, sources);
  printPending(sources);
  printTable(files);
  printPackages(files);
  return printVerdict({ config, total: percentOf(ratioOf(files)), fresh, base });
}

process.exit((await main()) ? 0 : 1);
