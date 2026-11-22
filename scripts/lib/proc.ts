// Small process helpers shared by the dev-loop scripts (check, integrate, done).
export interface StepResult {
  name: string;
  ok: boolean;
  skipped: boolean;
  seconds: number;
  output: string;
}

export interface RunOptions {
  cwd?: string;
  env?: Record<string, string>;
}

function spawnBase(options: RunOptions): { env: Record<string, string | undefined>; cwd?: string } {
  const env = { ...process.env, ...options.env };
  return options.cwd === undefined ? { env } : { env, cwd: options.cwd };
}

/** Runs a command to completion, capturing stdout and stderr together. Never throws. */
export async function runCapture(
  name: string,
  command: string[],
  options: RunOptions = {},
): Promise<StepResult> {
  const started = performance.now();
  const child = Bun.spawn(command, { ...spawnBase(options), stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([
    child.stdout.text(),
    child.stderr.text(),
    child.exited,
  ]);
  const seconds = (performance.now() - started) / 1000;
  return { name, ok: code === 0, skipped: false, seconds, output: out + err };
}

export function skippedStep(name: string): StepResult {
  return { name, ok: true, skipped: true, seconds: 0, output: "" };
}

/** Runs a command with its output shown live. Returns the exit code. */
export async function runLive(command: string[], options: RunOptions = {}): Promise<number> {
  const child = Bun.spawn(command, { ...spawnBase(options), stdout: "inherit", stderr: "inherit" });
  return child.exited;
}

/** Moves to the repository root, so paths from git are valid whatever directory we started in. */
export function enterRepoRoot(): void {
  process.chdir(git(["rev-parse", "--show-toplevel"]).out);
}

/** Runs git synchronously. `ok` is false on a non-zero exit; `out` is trimmed stdout. */
export function git(args: string[], options: RunOptions = {}): { ok: boolean; out: string } {
  const run = Bun.spawnSync(["git", ...args], spawnBase(options));
  const out = run.stdout.toString().trim();
  const failure = `${out}\n${run.stderr.toString()}`.trim();
  return { ok: run.exitCode === 0, out: run.exitCode === 0 ? out : failure };
}

export function gitLines(args: string[], options: RunOptions = {}): string[] {
  const { ok, out } = git(args, options);
  if (!ok) throw new Error(`git ${args.join(" ")} failed: ${out}`);
  return out === "" ? [] : out.split("\n");
}
