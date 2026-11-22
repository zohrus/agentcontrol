// `bun test` only discovers *.test.ts / *.spec.ts, so *.e2e.ts files are passed explicitly.
// Every test owns its data folder, repo and relay, so each file runs in its own `bun test`
// process and the files run side by side; output is printed per file, in file order.
//
// The product runs inside the test process (so coverage can see it). A few files also run a
// second time against real subprocesses, to prove the shipped wiring: the app's `main.ts`, the
// relay bridge and the detached daemon.
//
// `--coverage` makes every in-process run write `coverage/parts/<name>/lcov.info`.
import { rmSync } from "node:fs";
import { availableParallelism } from "node:os";

const TEST_TIMEOUT_MS = 20_000;
const PARALLEL_FILES = 4;
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

function commandFor(job: Job, coverage: boolean): string[] {
  const command = ["bun", "test", "--timeout", String(TEST_TIMEOUT_MS)];
  if (coverage && !job.inSubprocesses) {
    const dir = `${PARTS_DIR}/${partName(job.file).replaceAll("/", "-")}`;
    command.push("--coverage", "--coverage-reporter=lcov", `--coverage-dir=${dir}`);
  }
  return [...command, `./${job.file}`];
}

async function runJob(job: Job, coverage: boolean): Promise<JobRun> {
  const env = { ...Bun.env, AGENTCONTROL_E2E_PROCESSES: job.inSubprocesses ? "1" : "0" };
  const run = Bun.spawn(commandFor(job, coverage), { stdout: "pipe", stderr: "pipe", env });
  const [out, err, exitCode] = await Promise.all([
    run.stdout.text(),
    run.stderr.text(),
    run.exited,
  ]);
  return { name: job.name, exitCode, output: out + err };
}

async function runAll(jobs: Job[], coverage: boolean): Promise<JobRun[]> {
  const results: JobRun[] = [];
  const queue = [...jobs];
  const worker = async (): Promise<void> => {
    for (let job = queue.shift(); job !== undefined; job = queue.shift()) {
      const finished = await runJob(job, coverage);
      results.push(finished);
      console.log(`${finished.exitCode === 0 ? "pass" : "FAIL"} ${finished.name}`);
    }
  };
  const workers = Math.min(PARALLEL_FILES, availableParallelism());
  await Promise.all(Array.from({ length: workers }, worker));
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

function jobsFor(files: string[]): Job[] {
  const inProcess = files.map((file) => ({ name: file, file, inSubprocesses: false }));
  const asProcesses = SUBPROCESS_FILES.map((file) => ({
    name: `${file} (subprocesses)`,
    file,
    inSubprocesses: true,
  }));
  return [...asProcesses, ...inProcess];
}

const coverage = process.argv.includes("--coverage");
const files = [...new Bun.Glob("e2e/**/*.e2e.ts").scanSync({ cwd: process.cwd() })].sort();

if (files.length === 0) {
  console.log("no *.e2e.ts files yet");
} else {
  if (coverage) rmSync("coverage", { recursive: true, force: true });
  const results = await runAll(jobsFor(files), coverage);
  const failed = results.filter((result) => result.exitCode !== 0);
  for (const result of failed) console.log(`\n${result.name}\n${result.output}`);
  console.log(`${String(results.length - failed.length)} of ${String(results.length)} runs passed`);
  process.exit(failed.length === 0 ? 0 : 1);
}
