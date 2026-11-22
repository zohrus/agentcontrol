// `bun run done <owned-path>...`: the definition of done, checkable by a machine. Runs the full
// check, then prints a DONE-REPORT block that the orchestrator parses instead of prose. Exits
// non-zero when a rule is broken: files outside the owned paths, dependency changes, any change
// to eslint.config.js (the limits), or a new eslint-disable.
import { readFileSync, rmSync } from "node:fs";
import {
  addedFiles,
  changedFiles,
  countAddedLines,
  fileDiffers,
  mergeBase,
} from "./lib/changes.ts";
import { dependenciesChanged, isPackageJson } from "./lib/deps.ts";
import { enterRepoRoot, git, runLive } from "./lib/proc.ts";

const DISABLE_DIRECTIVE = /(\/\/|\/\*)\s*eslint-disable/;

function owns(owned: string[], path: string): boolean {
  return owned.some(
    (prefix) => path === prefix || path.startsWith(`${prefix.replace(/\/$/, "")}/`),
  );
}

function showAtBase(base: string, path: string): string | null {
  const shown = git(["show", `${base}:${path}`]);
  return shown.ok ? shown.out : null;
}

function readOrNull(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function dependencyChanges(base: string, files: string[]): string[] {
  const lock = files.filter((path) => path === "bun.lock");
  const manifests = files.filter(isPackageJson);
  const changed = manifests.filter((path) =>
    dependenciesChanged(showAtBase(base, path), readOrNull(path)),
  );
  return [...lock, ...changed];
}

function readCheck(): { result: string; seconds: number } {
  try {
    const timing = JSON.parse(readFileSync(".check-timing.json", "utf8")) as {
      ok: boolean;
      totalSeconds: number;
    };
    return { result: timing.ok ? "pass" : "fail", seconds: Math.round(timing.totalSeconds) };
  } catch {
    return { result: "fail", seconds: 0 };
  }
}

function violations(report: Record<string, unknown>): string[] {
  const rules: [boolean, string][] = [
    [(report.outsideOwned as string[]).length > 0, "files changed outside the owned paths"],
    [(report.dependencyChanges as string[]).length > 0, "dependency changes"],
    [
      report.eslintConfigChanged === true,
      "eslint.config.js changed (limits only go down by the orchestrator)",
    ],
    [(report.eslintDisableAdded as number) > 0, "new eslint-disable"],
    [report.check !== "pass", "bun run check did not pass"],
  ];
  return rules.filter(([broken]) => broken).map(([, message]) => message);
}

function buildReport(owned: string[], base: string): Record<string, unknown> {
  const files = changedFiles(base);
  const check = readCheck();
  return {
    branch: git(["branch", "--show-current"]).out,
    base,
    head: git(["rev-parse", "HEAD"]).out,
    outsideOwned: files.filter((path) => !owns(owned, path)),
    check: check.result,
    checkSeconds: check.seconds,
    e2eFilesAdded: addedFiles(base).filter((path) => path.endsWith(".e2e.ts")),
    eslintDisableAdded: countAddedLines(base, DISABLE_DIRECTIVE),
    eslintConfigChanged: fileDiffers(base, "eslint.config.js"),
    dependencyChanges: dependencyChanges(base, files),
    protocolChanged: files.some((path) => path.startsWith("packages/protocol/")),
    decisionFilesAdded: addedFiles(base).filter((p) => /^docs\/decisions\/\d.*\.md$/.test(p)),
  };
}

function render(report: Record<string, unknown>): string {
  const lines = Object.entries(report).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  return `\`\`\`DONE-REPORT\n${lines.join("\n")}\ncode-review: <must be filled by the agent>\n\`\`\``;
}

/** Runs the full check from the repo root, with no gate skipped and no stale timing file. */
async function runCheck(): Promise<number> {
  enterRepoRoot();
  rmSync(".check-timing.json", { force: true });
  return runLive(["bun", "run", "check"], { env: { CHECK_SKIP: "" } });
}

async function main(): Promise<number> {
  const owned = process.argv.slice(2);
  if (owned.length === 0) {
    console.error("usage: bun run done <owned-path>...   (the paths your brief says you own)");
    return 1;
  }
  const code = await runCheck();
  const report = buildReport(owned, mergeBase());
  if (code !== 0) report.check = "fail";
  console.log(render(report));
  const broken = violations(report);
  for (const message of broken) console.error(`RULE BROKEN: ${message}`);
  return broken.length === 0 ? 0 : 1;
}

process.exit(await main());
