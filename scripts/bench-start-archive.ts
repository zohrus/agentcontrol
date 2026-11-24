// Times starting and archiving a session on a big repository, with the mock agent.
// Usage: bun scripts/bench-start-archive.ts [--files 20000] [--modules 50000] [--runs 3]
//          [--boot <ms the adapter takes to start>] [--latency <ms every remote command waits>]
//          [--watch] [--trace] [--commands]
// Prints markdown tables of the median of the runs. Everything is read from the session's events
// and the clock, so it runs on any version of the relay. Not part of `bun run check`: it is slow on
// purpose and the numbers depend on the machine. The e2e suite proves behaviour; this proves where
// the time goes.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanUpAfterTest } from "../e2e/support/setup/cleanup.ts";
import { commandTimings, removeTiming } from "./bench/commands.ts";
import { oneRun, type Rows } from "./bench/one-run.ts";
import { startBigWorld } from "./bench/world.ts";

const flag = (name: string, fallback: number): number => {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? fallback : Number(process.argv[at + 1]);
};
const has = (name: string): boolean => process.argv.includes(`--${name}`);

const median = (values: number[]): number => {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

function print(call: { title: string; all: Rows[]; runs: number }): void {
  const { title, all, runs } = call;
  console.log(`\n### ${title} (median of ${String(runs)}, ms)\n\n| Step | ms |\n|---|---|`);
  for (const name of Object.keys(all[0] ?? {})) {
    console.log(`| ${name} | ${String(Math.round(median(all.map((r) => r[name] ?? 0))))} |`);
  }
}

const sizes = {
  repoFiles: flag("files", 20_000),
  moduleFiles: flag("modules", 50_000),
  remoteLatencyMs: flag("latency", 0),
};
const runs = flag("runs", 3);
const { app, makeModules } = await startBigWorld(sizes);
// A real adapter needs seconds to load before it listens; the mock can be told to take as long.
if (flag("boot", 0) > 0) app.mockAgent.bootsInMs(flag("boot", 0));
await app.mockAgent.writeScript();

const results = [];
for (let run = 0; run < runs; run++) {
  results.push(await oneRun({ app, watch: has("watch"), trace: has("trace") && run === runs - 1 }));
}
console.log(
  `\n## ${String(sizes.repoFiles)} tracked files, ${String(sizes.moduleFiles)} ignored files, adapter boot ${String(flag("boot", 0))} ms, remote latency ${String(sizes.remoteLatencyMs)} ms`,
);
print({ title: "Start", all: results.map((r) => r.started), runs });
print({ title: "Archive", all: results.map((r) => r.archived), runs });
const steps = results.at(-1)?.steps ?? [];
if (steps.length > 0)
  console.log(`\nSteps the last session said:\n${steps.map((l) => `- ${l}`).join("\n")}`);

if (has("commands")) {
  const scratch = await mkdtemp(join(tmpdir(), "agentcontrol-bench-"));
  const call = { repoPath: app.repoPath, scratch, makeModules };
  console.log("\n### The git commands by hand, one after the other\n\n| Command | ms |\n|---|---|");
  const timings = [...(await commandTimings(call)), await removeTiming(call)];
  for (const { name, ms } of timings) console.log(`| ${name} | ${String(ms)} |`);
  await rm(scratch, { recursive: true, force: true });
}
await cleanUpAfterTest();
process.exit(0);
