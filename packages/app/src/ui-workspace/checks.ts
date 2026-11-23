import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface CommandResult {
  exitCode: number;
  /** stdout and stderr together. */
  output: string;
}

/** Runs one command with an argument array. Injected so tests can skip the slow real tools. */
export type RunCommand = (options: { cmd: string[]; cwd: string }) => Promise<CommandResult>;

export interface CheckResult {
  ok: boolean;
  steps: { name: "typecheck" | "build"; ok: boolean; output: string }[];
}

type CheckStep = CheckResult["steps"][number];

const MAX_LINES = 200;
const TIMEOUT_MS = 5 * 60_000;
/** Makes a compiled app binary behave as the `bun` command, so it can run vite and tsc itself. */
const BE_BUN = { BUN_BE_BUN: "1" };

export const runWithBun: RunCommand = async ({ cmd, cwd }) => {
  const proc = Bun.spawn(cmd, {
    cwd,
    env: { ...process.env, ...BE_BUN },
    stdout: "pipe",
    stderr: "pipe",
    timeout: TIMEOUT_MS,
  });
  const [out, err, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exitCode, output: out + err };
};

function lastLines(text: string): string {
  return text.trim().split("\n").slice(-MAX_LINES).join("\n");
}

async function step(options: {
  name: CheckStep["name"];
  run: RunCommand;
  cmd: string[];
  cwd: string;
}): Promise<CheckStep> {
  const result = await options
    .run({ cmd: options.cmd, cwd: options.cwd })
    .catch((error: unknown) => ({ exitCode: 1, output: String(error) }));
  return { name: options.name, ok: result.exitCode === 0, output: lastLines(result.output) };
}

async function build(options: { stagingDir: string; run: RunCommand }): Promise<CheckStep> {
  const outDir = await mkdtemp(join(tmpdir(), "agentcontrol-ui-build-"));
  const vite = join(options.stagingDir, "node_modules", "vite", "bin", "vite.js");
  const result = await step({
    name: "build",
    run: options.run,
    cwd: options.stagingDir,
    // The "runner" config loader writes no temporary file into the (shared) node_modules.
    cmd: [
      process.execPath,
      vite,
      "build",
      "--configLoader",
      "runner",
      "--outDir",
      outDir,
      "--emptyOutDir",
    ],
  });
  await rm(outDir, { recursive: true, force: true });
  return result;
}

/**
 * The TypeScript compiler the checks run: the one in the UI's own node_modules (a release ships
 * it there), or the repository's when running from source.
 */
function typescriptBin(stagingDir: string): string {
  const shipped = join(stagingDir, "node_modules", "typescript", "bin", "tsc");
  return existsSync(shipped)
    ? shipped
    : createRequire(import.meta.url).resolve("typescript/bin/tsc");
}

/**
 * Typecheck with the template's own tsc project, then build with the linked vite into a temp
 * folder outside the live folder. Both run through the current Bun binary, which needs no node.
 * The build is skipped when the typecheck fails: the agent fixes one thing at a time.
 */
export async function runChecks(options: {
  stagingDir: string;
  run: RunCommand;
}): Promise<CheckResult> {
  const { stagingDir, run } = options;
  const tsc = typescriptBin(stagingDir);
  const typecheck = await step({
    name: "typecheck",
    run,
    cwd: stagingDir,
    cmd: [process.execPath, tsc, "-p", "tsconfig.json"],
  });
  if (!typecheck.ok) return { ok: false, steps: [typecheck] };
  const built = await build({ stagingDir, run });
  return { ok: built.ok, steps: [typecheck, built] };
}
