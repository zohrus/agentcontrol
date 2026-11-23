// `bun test` only discovers *.test.ts / *.spec.ts, so *.e2e.ts files are passed explicitly.
// Every test owns its data folder, repo and relay, so each file runs in its own `bun test`
// process and the files run side by side; output is printed per file, in file order.
//
// The product runs inside the test process (so coverage can see it). A few files also run a
// second time against real subprocesses, to prove the shipped wiring: the app's `main.ts`, the
// relay bridge and the detached daemon.
//
// `--coverage` makes every in-process run write `coverage/parts/<name>/lcov.info`; browser tests add
// `coverage/parts/<name>-browser-<n>/lcov.info` for the UI code the browser ran.
// Arguments that are not flags select files by path prefix (`bun scripts/run-e2e.ts e2e/browser`);
// a selective coverage run keeps the parts of the files it does not run.
import { mkdirSync, rmSync } from "node:fs";
import { availableParallelism } from "node:os";

const TEST_TIMEOUT_MS = 20_000;
const PARALLEL_FILES = 4;
const MAX_BROWSER_FILES = 2;
/** Where scripts/coverage.ts reads the per-file reports from. */
const PARTS_DIR = "coverage/parts";

/** Files that also run against real subprocesses (AGENTCONTROL_E2E_PROCESSES=1). */
const SUBPROCESS_FILES = [
  "e2e/sessions/restart.e2e.ts",
  "e2e/sessions/app-waiting-on-you.e2e.ts",
  "e2e/sync/app-restart.e2e.ts",
];

interface Job {
  name: string;
  file: string;
  inSubprocesses: boolean;
}

interface JobRun {
  name: string;
  exitCode: number;
  output: string;
}

const partName = (file: string): string => file.replace(/^e2e\//, "").replace(/\.e2e\.ts$/, "");

/** Where this job's browser tests write their parts; the test adds `-<n>`. */
const browserPartsPrefix = (job: Job): string =>
  `${PARTS_DIR}/${partName(job.file).replaceAll("/", "-")}${job.inSubprocesses ? "-sub" : ""}-browser`;

function commandFor(job: Job, coverage: boolean): string[] {
  const command = ["bun", "test", "--timeout", String(TEST_TIMEOUT_MS)];
  if (coverage && !job.inSubprocesses) {
    const dir = `${PARTS_DIR}/${partName(job.file).replaceAll("/", "-")}`;
    command.push("--coverage", "--coverage-reporter=lcov", `--coverage-dir=${dir}`);
  }
  return [...command, `./${job.file}`];
}

/**
 * Git sets GIT_DIR and friends when it runs a hook. A test that inherits them runs its `git init`
 * and `git config` against this repository instead of its own temporary one.
 */
function withoutGitHookEnv(): Record<string, string | undefined> {
  const entries = Object.entries(Bun.env).filter(([name]) => !name.startsWith("GIT_"));
  return Object.fromEntries(entries);
}

async function runJob(job: Job, coverage: boolean): Promise<JobRun> {
  const env: Record<string, string | undefined> = {
    ...withoutGitHookEnv(),
    AGENTCONTROL_E2E_PROCESSES: job.inSubprocesses ? "1" : "0",
  };
  // Browser tests write what the UI ran as one more lcov part (e2e/support/browser/ui-coverage).
  if (coverage) env["AGENTCONTROL_BROWSER_COVERAGE_PARTS"] = browserPartsPrefix(job);
  const run = Bun.spawn(commandFor(job, coverage), { stdout: "pipe", stderr: "pipe", env });
  const [out, err, exitCode] = await Promise.all([
    run.stdout.text(),
    run.stderr.text(),
    run.exited,
  ]);
  return { name: job.name, exitCode, output: out + err };
}

/** Runs the jobs of one group, `workers` at a time, adding each result to `results`. */
async function drain(
  group: { jobs: Job[]; workers: number },
  options: { coverage: boolean; results: JobRun[] },
): Promise<void> {
  const queue = [...group.jobs];
  const worker = async (): Promise<void> => {
    for (let job = queue.shift(); job !== undefined; job = queue.shift()) {
      const finished = await runJob(job, options.coverage);
      options.results.push(finished);
      console.log(`${finished.exitCode === 0 ? "pass" : "FAIL"} ${finished.name}`);
    }
  };
  await Promise.all(Array.from({ length: group.workers }, worker));
}

/** Browser files run at most two at a time (each starts Chromium); the rest fill the other workers. */
async function runAll(jobs: Job[], coverage: boolean): Promise<JobRun[]> {
  const results: JobRun[] = [];
  const isBrowser = (job: Job): boolean => job.file.startsWith("e2e/browser/");
  const total = Math.min(PARALLEL_FILES, availableParallelism());
  const browserWorkers = Math.min(MAX_BROWSER_FILES, total);
  await Promise.all([
    drain({ jobs: jobs.filter(isBrowser), workers: browserWorkers }, { coverage, results }),
    drain(
      { jobs: jobs.filter((job) => !isBrowser(job)), workers: total - browserWorkers || 1 },
      { coverage, results },
    ),
  ]);
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

/** `FAILED <file>: <failing test names>`, from the `(fail) name [ms]` lines bun test printed. */
function failureLine(result: JobRun): string {
  const tests = result.output
    .split("\n")
    .filter((line) => line.startsWith("(fail) "))
    .map((line) => line.slice("(fail) ".length).replace(/ \[[\d.]+m?s\]$/, ""));
  return `FAILED ${result.name}: ${tests.length === 0 ? "no test failed by name (the run itself broke)" : tests.join("; ")}`;
}

function jobsFor(files: string[]): Job[] {
  const inProcess = files.map((file) => ({ name: file, file, inSubprocesses: false }));
  const asProcesses = SUBPROCESS_FILES.filter((file) => files.includes(file)).map((file) => ({
    name: `${file} (subprocesses)`,
    file,
    inSubprocesses: true,
  }));
  return [...asProcesses, ...inProcess];
}

/** Deletes the reports of the last run: all of them, or only those of the files about to run again. */
function forgetOldParts(jobs: Job[], onlyThese: boolean): void {
  if (!onlyThese) {
    rmSync("coverage", { recursive: true, force: true });
    return;
  }
  mkdirSync(PARTS_DIR, { recursive: true });
  const names = jobs.map((job) => partName(job.file).replaceAll("/", "-"));
  for (const name of names) {
    const old = new Bun.Glob(`${name}{,-browser-*}`).scanSync({ cwd: PARTS_DIR, onlyFiles: false });
    for (const part of old) rmSync(`${PARTS_DIR}/${part}`, { recursive: true, force: true });
  }
}

const coverage = process.argv.includes("--coverage");
/** True when `file` is `path` itself or lies in the folder `path`, or is that file name without its end. */
const isUnder = (file: string, path: string): boolean =>
  file === path ||
  file.startsWith(`${path.replace(/\/$/, "")}/`) ||
  file.startsWith(path.replace(".e2e.ts", "") + ".");

const selected = process.argv.slice(2).filter((argument) => !argument.startsWith("--"));
const files = [...new Bun.Glob("e2e/**/*.e2e.ts").scanSync({ cwd: process.cwd() })]
  .filter((file) => selected.length === 0 || selected.some((path) => isUnder(file, path)))
  .sort();

if (files.length === 0) {
  console.log("no *.e2e.ts files yet");
} else {
  const jobs = jobsFor(files);
  if (coverage) forgetOldParts(jobs, selected.length > 0);
  const results = await runAll(jobs, coverage);
  const failed = results.filter((result) => result.exitCode !== 0);
  for (const result of failed) console.log(`\n${result.name}\n${result.output}`);
  console.log(`${String(results.length - failed.length)} of ${String(results.length)} runs passed`);
  // The last lines of the log name what failed, so a red run is readable from its end.
  for (const result of failed) console.log(failureLine(result));
  process.exit(failed.length === 0 ? 0 : 1);
}
