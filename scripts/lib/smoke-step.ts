// The compiled-app smoke of `bun run integrate`: after the checks pass and before anything is
// pushed, the Linux app is built and its smoke test run, because the checks run the source and
// only the compiled app shows what a release would do. A change that touches nothing but
// documentation (everything under docs/ or a Markdown file) cannot break it and skips it.
import { gitLines, runLive } from "./proc.ts";

const APP_DIR = "dist/release/linux-x64";

/** Whether every path is documentation: under docs/, or a Markdown file. */
const isDocsOnly = (paths: readonly string[]): boolean =>
  paths.every((path) => path.startsWith("docs/") || path.endsWith(".md"));

/** The files the branch (checked out in `scratch`) changes compared with origin/main. */
function changedFiles(scratch: string): string[] {
  return gitLines(["diff", "--name-only", "origin/main", "HEAD"], { cwd: scratch });
}

async function buildAndSmoke(scratch: string): Promise<void> {
  const built = await runLive(["bun", "run", "build:linux"], { cwd: scratch });
  if (built !== 0) throw new Error("the Linux app did not build; nothing was pushed");
  const args = ["bun", "scripts/smoke-binary.ts", "--app", APP_DIR];
  if ((await runLive(args, { cwd: scratch })) !== 0) {
    throw new Error("the compiled-app smoke failed; nothing was pushed");
  }
}

/** Refuses `--skip-smoke` for a change that is not documentation only; run before the checks. */
export function refuseSkipForCode(call: { scratch: string; skip: boolean }): void {
  if (!call.skip || isDocsOnly(changedFiles(call.scratch))) return;
  throw new Error("--skip-smoke is only for changes to docs/ and Markdown files");
}

/** Builds the compiled app and runs its smoke test, unless only documentation changed. */
export async function smokeTestTheApp(scratch: string): Promise<void> {
  if (isDocsOnly(changedFiles(scratch))) {
    console.log("integrate: only documentation changed, skipping the compiled-app smoke");
    return;
  }
  console.log("integrate: building the compiled app and running its smoke test");
  await buildAndSmoke(scratch);
}
