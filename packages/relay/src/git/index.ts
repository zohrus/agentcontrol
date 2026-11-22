export interface GitOptions {
  cwd: string;
  env?: Record<string, string>;
}

export interface GitResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Runs `git` with an argument array and returns its output, whatever the exit code. */
export async function runGit(args: string[], options: GitOptions): Promise<GitResult> {
  const proc = Bun.spawn(["git", ...args], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdout: "pipe",
    stderr: "pipe",
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
export { parseStatus, type StatusEntry } from "./status.ts";
