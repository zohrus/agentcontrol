// Pre-commit guard (lefthook): only the orchestrator changes dependencies. Fails when a commit on
// any other branch stages bun.lock or a package.json whose dependency sections changed.
// Orchestrator branches: main, orchestrator*, queue/*, integrate*. Escape hatch: ALLOW_DEP_CHANGE=1.
// While a merge is being committed, a file that ends up exactly as it is in the merged-in commit
// (MERGE_HEAD, normally origin/main) is not a change by this branch, so it is let through.
import { dependenciesChanged, isPackageJson } from "./lib/deps.ts";
import { git, gitLines } from "./lib/proc.ts";

const ALLOWED_BRANCH = /^(main|orchestrator.*|queue\/.*|integrate.*)$/;

function stagedDependencyFiles(): string[] {
  const staged = gitLines(["diff", "--cached", "--name-only", "--diff-filter=ACMRD"]);
  return staged.filter((path) => path === "bun.lock" || isPackageJson(path));
}

/** True when the staged file is, byte for byte, the one the merge brings in from the other side. */
function comesFromMerge(path: string): boolean {
  const merged = git(["show", `MERGE_HEAD:${path}`]);
  return merged.ok && merged.out === git(["show", `:${path}`]).out;
}

function changedDependencies(path: string): boolean {
  if (comesFromMerge(path)) return false;
  if (path === "bun.lock") return true;
  const before = git(["show", `HEAD:${path}`]);
  const after = git(["show", `:${path}`]);
  return dependenciesChanged(before.ok ? before.out : null, after.ok ? after.out : null);
}

function main(): number {
  const branch = git(["branch", "--show-current"]).out;
  if (process.env.ALLOW_DEP_CHANGE === "1" || ALLOWED_BRANCH.test(branch)) return 0;
  const offending = stagedDependencyFiles().filter(changedDependencies);
  if (offending.length === 0) return 0;
  console.error(`Dependency change blocked on branch "${branch}": ${offending.join(", ")}`);
  console.error("Only the orchestrator changes dependencies. Ask for it in your report.");
  return 1;
}

process.exit(main());
