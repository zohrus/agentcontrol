// `bun run check`: every quality gate as a named step, with timing.
// Read-only gates run in parallel; tests start as soon as typecheck passes. All failures are
// shown, not just the first. The test step is `test:coverage` if package.json has it, else `test`.
// CHECK_SKIP=audit,dup skips named gates (CI uses it to keep the audit out of the blocking job).
// Writes .check-timing.json (gitignored) with the seconds per gate.
import { readFileSync, writeFileSync } from "node:fs";
import { runCapture, type StepResult, skippedStep } from "./lib/proc.ts";

const PARALLEL_GATES = ["lint", "format:check", "deps", "knip", "dup", "acp-leaks", "audit"];

function packageScripts(): Record<string, string> {
  const text = readFileSync("package.json", "utf8");
  return (JSON.parse(text) as { scripts: Record<string, string> }).scripts;
}

function skipList(): Set<string> {
  return new Set((process.env.CHECK_SKIP ?? "").split(",").filter((name) => name !== ""));
}

function gate(script: string, skip: Set<string>): Promise<StepResult> {
  if (skip.has(script)) return Promise.resolve(skippedStep(script));
  return runCapture(script, ["bun", "run", script]);
}

async function testsAfter(typecheck: Promise<StepResult>, script: string): Promise<StepResult> {
  const typed = await typecheck;
  return typed.ok ? runCapture(script, ["bun", "run", script]) : skippedStep(script);
}

function statusOf(result: StepResult): string {
  if (result.skipped) return "skipped";
  return result.ok ? "ok" : "FAILED";
}

function formatRow(result: StepResult): string {
  const status = statusOf(result);
  return `${result.name.padEnd(14)} ${status.padEnd(8)} ${result.seconds.toFixed(1).padStart(6)}s`;
}

function printSummary(results: StepResult[], totalSeconds: number): void {
  console.log("\ngate           result    seconds");
  console.log("-".repeat(32));
  for (const result of results) console.log(formatRow(result));
  console.log("-".repeat(32));
  console.log(`${"total".padEnd(23)} ${totalSeconds.toFixed(1).padStart(6)}s`);
}

function printFailures(results: StepResult[]): void {
  for (const result of results.filter((step) => !step.ok)) {
    console.log(`\n===== ${result.name} failed =====\n${result.output.trim()}`);
  }
}

function writeTiming(results: StepResult[], totalSeconds: number): void {
  const gates = results.map(({ name, ok, skipped, seconds }) => ({ name, ok, skipped, seconds }));
  const ok = results.every((step) => step.ok);
  writeFileSync(".check-timing.json", `${JSON.stringify({ ok, totalSeconds, gates }, null, 2)}\n`);
}

function finish(results: StepResult[], started: number): never {
  const totalSeconds = (performance.now() - started) / 1000;
  printFailures(results);
  printSummary(results, totalSeconds);
  writeTiming(results, totalSeconds);
  process.exit(results.every((step) => step.ok) ? 0 : 1);
}

async function main(): Promise<void> {
  const started = performance.now();
  const skip = skipList();
  const testScript = "test:coverage" in packageScripts() ? "test:coverage" : "test";
  const typecheck = gate("typecheck", skip);
  const others = PARALLEL_GATES.map((name) => gate(name, skip));
  const tests = testsAfter(typecheck, testScript);
  finish(await Promise.all([typecheck, ...others, tests]), started);
}

await main();
