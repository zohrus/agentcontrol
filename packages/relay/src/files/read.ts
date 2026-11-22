import { ErrorCode } from "@agentcontrol/protocol";
import { git, runGit } from "../git/index.ts";
import { RelayError } from "../rpc/index.ts";
import { hashContent } from "./hash.ts";
import { resolveInside } from "./safe-path.ts";

async function readCommitted(options: {
  worktreePath: string;
  path: string;
  commit: string;
}): Promise<string> {
  const args = ["show", `${options.commit}:${options.path}`];
  const result = await runGit(args, {
    cwd: options.worktreePath,
    // English messages, so "does not exist" can be recognised on any machine.
    env: { LC_ALL: "C" },
  });
  if (result.exitCode === 0) return result.stdout;
  if (/does not exist in|exists on disk, but not in/.test(result.stderr)) {
    throw new RelayError(
      ErrorCode.fileNotFound,
      `"${options.path}" does not exist at that version.`,
    );
  }
  throw new Error(`git show failed: ${result.stderr.trim()}`);
}

/** Reads the current content of a file in the worktree; a missing file is a `fileNotFound` error. */
async function readWorking(worktreePath: string, path: string): Promise<string> {
  const file = Bun.file(await resolveInside(worktreePath, path));
  if (!(await file.exists())) {
    throw new RelayError(ErrorCode.fileNotFound, `"${path}" does not exist.`);
  }
  return file.text();
}

async function contentAt(options: {
  worktreePath: string;
  path: string;
  ref: "base" | "head" | "working";
  baseBranch: string;
}): Promise<string> {
  const { worktreePath, path, ref } = options;
  if (ref === "working") return readWorking(worktreePath, path);
  await resolveInside(worktreePath, path);
  const commit =
    ref === "head"
      ? "HEAD"
      : (await git(["merge-base", options.baseBranch, "HEAD"], { cwd: worktreePath })).trim();
  return readCommitted({ worktreePath, path, commit });
}

/** Content of a file at the base commit, at HEAD, or in the working tree, with its hash. */
export async function readFileAt(options: {
  worktreePath: string;
  path: string;
  ref: "base" | "head" | "working";
  baseBranch: string;
}): Promise<{ content: string; hash: string }> {
  const content = await contentAt(options);
  return { content, hash: hashContent(content) };
}
