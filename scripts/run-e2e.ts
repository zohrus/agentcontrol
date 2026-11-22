// `bun test` only discovers *.test.ts / *.spec.ts, so *.e2e.ts files are passed explicitly.
// Every test owns its data folder, repo and daemon, so each file runs in its own `bun test`
// process and the files run side by side; output is printed per file, in file order.
import { availableParallelism } from "node:os";

const TEST_TIMEOUT_MS = 20_000;

interface FileRun {
  file: string;
  exitCode: number;
  output: string;
}

async function runFile(file: string): Promise<FileRun> {
  const command = ["bun", "test", "--timeout", String(TEST_TIMEOUT_MS), file];
  const run = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
  const [out, err, exitCode] = await Promise.all([
    run.stdout.text(),
    run.stderr.text(),
    run.exited,
  ]);
  return { file, exitCode, output: out + err };
}

async function runAll(files: string[]): Promise<FileRun[]> {
  const results: FileRun[] = [];
  const queue = [...files];
  const worker = async (): Promise<void> => {
    for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
      const finished = await runFile(file);
      results.push(finished);
      console.log(`${finished.exitCode === 0 ? "pass" : "FAIL"} ${finished.file}`);
    }
  };
  await Promise.all(Array.from({ length: availableParallelism() }, worker));
  return results.sort((a, b) => a.file.localeCompare(b.file));
}

const files = [...new Bun.Glob("e2e/**/*.e2e.ts").scanSync({ cwd: process.cwd() })]
  .map((file) => `./${file}`)
  .sort();

if (files.length === 0) {
  console.log("no *.e2e.ts files yet");
} else {
  const results = await runAll(files);
  const failed = results.filter((result) => result.exitCode !== 0);
  for (const result of failed) console.log(`\n${result.file}\n${result.output}`);
  console.log(
    `${String(results.length - failed.length)} of ${String(results.length)} files passed`,
  );
  process.exit(failed.length === 0 ? 0 : 1);
}
