// `bun run check:quick [paths...]`: the fast inner loop. Lints and format-checks only the given
// paths (default: files changed versus origin/main), plus an incremental typecheck and the
// dependency rules. No knip, duplication, audit or tests: `bun run check` runs those.
import { existsSync } from "node:fs";
import { changedFiles, mergeBase } from "./lib/changes.ts";
import { enterRepoRoot, runCapture, type StepResult, skippedStep } from "./lib/proc.ts";

const SOURCE = /^(packages|e2e|spike|scripts)\/.*\.(ts|tsx)$/;
const FORMATTED = /\.(ts|tsx|css|json|js)$/;

function targetPaths(args: string[]): string[] {
  const paths = args.length > 0 ? args : changedFiles(mergeBase());
  return paths.filter((path) => existsSync(path) && !path.startsWith(".claude/"));
}

function steps(paths: string[]): Promise<StepResult>[] {
  const lintable = paths.filter((path) => SOURCE.test(path));
  const formattable = paths.filter((path) => FORMATTED.test(path));
  const cache = ["--cache", "--cache-location", "node_modules/.cache/eslint/"];
  const lint = ["bunx", "eslint", ...cache, "--max-warnings", "0", ...lintable];
  const format = ["bunx", "biome", "format", "--error-on-warnings", ...formattable];
  return [
    lintable.length > 0 ? runCapture("eslint", lint) : Promise.resolve(skippedStep("eslint")),
    formattable.length > 0 ? runCapture("biome", format) : Promise.resolve(skippedStep("biome")),
    runCapture("typecheck", ["bun", "run", "typecheck"]),
    runCapture("deps", ["bun", "run", "deps"]),
  ];
}

async function main(): Promise<void> {
  const started = performance.now();
  enterRepoRoot();
  const paths = targetPaths(process.argv.slice(2));
  console.log(`check:quick on ${String(paths.length)} path(s)`);
  const results = await Promise.all(steps(paths));
  for (const result of results) {
    const status = result.ok ? "ok" : "FAILED";
    console.log(`${result.name.padEnd(10)} ${status.padEnd(7)} ${result.seconds.toFixed(1)}s`);
    if (!result.ok) console.log(result.output.trim());
  }
  const total = ((performance.now() - started) / 1000).toFixed(1);
  console.log(`total ${total}s`);
  process.exit(results.every((result) => result.ok) ? 0 : 1);
}

await main();
