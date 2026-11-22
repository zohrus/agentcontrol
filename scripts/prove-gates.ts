// Proves every quality gate breaks the build: for each case, write a deliberately bad sample,
// run the gate, assert it fails for the expected reason, then remove the sample.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { lintCases } from "./gates/lint-cases.ts";
import { depsCases, hygieneCases } from "./gates/tool-cases.ts";
import { type GateCase, OTHER_SAMPLE_DIR, SAMPLE_DIR } from "./gates/types.ts";

const EXTRA_SAMPLES = ["packages/relay/src/__gate_sample_root__.ts"];

function writeSamples(files: GateCase["files"], backups: Map<string, string | null>): void {
  for (const [path, content] of Object.entries(files)) {
    backups.set(path, existsSync(path) ? readFileSync(path, "utf8") : null);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
}

function restore(backups: Map<string, string | null>): void {
  for (const [path, original] of backups) {
    if (original === null) rmSync(path, { force: true });
    else writeFileSync(path, original);
  }
  rmSync(SAMPLE_DIR, { recursive: true, force: true });
  rmSync(OTHER_SAMPLE_DIR, { recursive: true, force: true });
  for (const extra of EXTRA_SAMPLES) rmSync(extra, { force: true });
}

function failsAsExpected(testCase: GateCase): boolean {
  const backups = new Map<string, string | null>();
  try {
    writeSamples(testCase.files, backups);
    const run = Bun.spawnSync([...testCase.command], { stdout: "pipe", stderr: "pipe" });
    const output = `${run.stdout.toString()}${run.stderr.toString()}`.toLowerCase();
    return run.exitCode !== 0 && output.includes(testCase.expect.toLowerCase());
  } finally {
    restore(backups);
  }
}

const cases = [...lintCases, ...depsCases, ...hygieneCases];
const results = cases.map((testCase) => ({ testCase, ok: failsAsExpected(testCase) }));
for (const { testCase, ok } of results) {
  console.log(`${ok ? "FAILED AS EXPECTED " : "DID NOT FAIL      "} ${testCase.name}`);
}
const bad = results.filter((result) => !result.ok).length;
console.log(bad === 0 ? "all gates break the build" : `${String(bad)} gate(s) did not fail`);
process.exit(bad === 0 ? 0 : 1);
