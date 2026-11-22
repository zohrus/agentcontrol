// Runs the coverage gate several times and fails when the set of covered lines differs between
// runs. A line that flips is a timing-dependent code path: fix it with an injected clock, a test
// that always runs it, or a restructure, never by lowering a threshold or excluding the file.
// Usage: bun scripts/coverage-stable.ts [runs]   (default 5; meant for CI's nightly job)
import { mkdirSync } from "node:fs";

const DEFAULT_RUNS = 5;
const EXIT_TESTS_FAILED = 2;
const KEPT_DIR = ".e2e-tmp/coverage-stable";

type CoveredLines = Record<string, number[]>;

async function runOnce(): Promise<{ exitCode: number; covered: CoveredLines }> {
  const run = Bun.spawn(["bun", "scripts/coverage.ts"], { stdout: "inherit", stderr: "inherit" });
  const exitCode = await run.exited;
  const covered = (await Bun.file("coverage/covered-lines.json").json()) as CoveredLines;
  return { exitCode, covered };
}

const spotsOf = (covered: CoveredLines): string[] =>
  Object.entries(covered).flatMap(([file, lines]) =>
    lines.map((line) => `${file}:${String(line)}`),
  );

/** Every `file:line` covered in some runs but not in all of them, with how many runs covered it. */
function flipsOf(runs: CoveredLines[]): string[] {
  const seen = new Map<string, number>();
  for (const spot of runs.flatMap(spotsOf)) seen.set(spot, (seen.get(spot) ?? 0) + 1);
  return [...seen]
    .filter(([, count]) => count < runs.length)
    .map(([spot, count]) => `${spot} (covered in ${String(count)} of ${String(runs.length)} runs)`)
    .sort();
}

async function collect(count: number): Promise<CoveredLines[] | undefined> {
  const results: CoveredLines[] = [];
  for (let run = 1; run <= count; run++) {
    console.log(`\n===== coverage run ${String(run)} of ${String(count)} =====`);
    const finished = await runOnce();
    if (finished.exitCode === EXIT_TESTS_FAILED) return undefined;
    await Bun.write(`${KEPT_DIR}/run-${String(run)}.json`, JSON.stringify(finished.covered));
    results.push(finished.covered);
  }
  return results;
}

async function main(): Promise<boolean> {
  const count = Number(process.argv[2] ?? DEFAULT_RUNS);
  mkdirSync(KEPT_DIR, { recursive: true });
  const results = await collect(count);
  if (results === undefined) return false;
  const flips = flipsOf(results);
  flips.forEach((flip) => {
    console.log(`UNSTABLE ${flip}`);
  });
  const verdict =
    flips.length === 0 ? "identical in all" : `${String(flips.length)} line(s) differ over`;
  console.log(`the covered lines were ${verdict} ${String(count)} runs`);
  return flips.length === 0;
}

process.exit((await main()) ? 0 : 1);
