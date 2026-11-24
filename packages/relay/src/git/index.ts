export interface GitOptions {
  cwd: string;
  env?: Record<string, string | undefined>;
  /** Stops git after this long, for commands that talk to a remote. */
  timeoutMs?: number;
}

export interface GitResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const HOOK_VARIABLES = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_COMMON_DIR",
  "GIT_PREFIX",
];

/** The environment without what git sets inside a hook, so `cwd` alone decides the repository. */
function inheritedEnv(): Record<string, string | undefined> {
  const entries = Object.entries(process.env).filter(([name]) => !HOOK_VARIABLES.includes(name));
  return Object.fromEntries(entries);
}

/** Runs `git` with an argument array and returns its output, whatever the exit code. */
export async function runGit(args: string[], options: GitOptions): Promise<GitResult> {
  const proc = Bun.spawn(["git", ...args], {
    cwd: options.cwd,
    env: { ...inheritedEnv(), ...options.env },
    stdout: "pipe",
    stderr: "pipe",
    ...(options.timeoutMs === undefined ? {} : { timeout: options.timeoutMs }),
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    proc.stdout.text(),
    proc.stderr.text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

/** Runs `git` and returns stdout; throws a plain-language Error on a non-zero exit. */
export async function git(args: string[], options: GitOptions): Promise<string> {
  const result = await runGit(args, options);
  if (result.exitCode !== 0) {
    throw new Error(`git ${args[0] ?? ""} failed: ${result.stderr.trim()}`);
  }
  return result.stdout;
}
export { parseStatus } from "./status.ts";
