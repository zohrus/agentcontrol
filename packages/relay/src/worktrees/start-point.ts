import { git, runGit } from "../git/index.ts";

/** What a new session's worktree starts from, and what to tell the user about it. */
export interface StartPoint {
  /** A branch or commit git understands, e.g. "origin/main". Stored as the session's base. */
  ref: string;
  /** Plain sentences for the session's setup output. */
  notes: string[];
}

const NETWORK_MS = 30_000;

/** Options for a command that talks to a remote: never wait for a password, never wait forever. */
const network = (cwd: string) => ({
  cwd,
  env: { GIT_TERMINAL_PROMPT: "0" },
  timeoutMs: NETWORK_MS,
});

const reasonOf = (error: unknown): string => {
  const text = error instanceof Error ? error.message : String(error);
  const line = text.split("\n").find((part) => part.trim() !== "") ?? text;
  return line.replace(/^git \w+ failed: /, "").replace(/^fatal: /, "");
};

async function refExists(cwd: string, ref: string): Promise<boolean> {
  const result = await runGit(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd });
  return result.exitCode === 0;
}

/** `origin` when the repository has it, else its first remote; undefined without any remote. */
async function remoteOf(cwd: string): Promise<string | undefined> {
  const names = (await git(["remote"], { cwd })).split("\n").filter((name) => name !== "");
  return names.includes("origin") ? "origin" : names[0];
}

/** The remote's own answer for what its HEAD is, e.g. "main". Needs the remote to be reachable. */
async function liveTrunk(cwd: string, remote: string): Promise<string> {
  const output = await git(["ls-remote", "--symref", remote, "HEAD"], network(cwd));
  const trunk = /^ref: refs\/heads\/(\S+)\tHEAD$/m.exec(output)?.[1];
  if (trunk === undefined) throw new Error(`${remote} has no default branch yet`);
  return trunk;
}

/** The remote trunk from the last time the repository heard from the remote, if it has one. */
async function lastKnownTrunk(cwd: string, remote: string): Promise<string | undefined> {
  const head = await runGit(["symbolic-ref", "--short", `refs/remotes/${remote}/HEAD`], { cwd });
  const candidates = [head.stdout.trim(), `${remote}/main`, `${remote}/master`];
  for (const ref of candidates.filter((name) => name !== "")) {
    if (await refExists(cwd, ref)) return ref;
  }
  return undefined;
}

/** The checked-out branch of the repository, or its commit when HEAD is detached. */
async function localStart(cwd: string, why: string): Promise<StartPoint> {
  const branch = await runGit(["symbolic-ref", "--short", "HEAD"], { cwd });
  const detached = (await git(["rev-parse", "HEAD"], { cwd })).trim();
  const ref = branch.exitCode === 0 ? branch.stdout.trim() : detached;
  return { ref, notes: [`${why}, so the session starts from the local ${ref}.`] };
}

async function fetchedTrunk(cwd: string, remote: string): Promise<StartPoint> {
  const trunk = await liveTrunk(cwd, remote);
  const refspec = `+refs/heads/${trunk}:refs/remotes/${remote}/${trunk}`;
  await git(["fetch", remote, refspec], network(cwd));
  const ref = `${remote}/${trunk}`;
  return { ref, notes: [`Started from the latest ${ref}.`] };
}

async function unreachable(options: {
  cwd: string;
  remote: string;
  error: unknown;
}): Promise<StartPoint> {
  const { cwd, remote } = options;
  const problem = `Could not get the latest from ${remote} (${reasonOf(options.error)})`;
  const known = await lastKnownTrunk(cwd, remote);
  if (known === undefined) return localStart(cwd, `${problem} and it has no known branch`);
  const note = `${problem}, so the session starts from the last known ${known}, which may be out of date.`;
  return { ref: known, notes: [note] };
}

/**
 * Where a session without a named branch starts: the tip of the remote's default branch after a
 * fetch. The trunk is asked from the remote itself (`ls-remote --symref`), because
 * `refs/remotes/origin/HEAD` is only set by `git clone` and goes stale when the remote renames it.
 * Without a remote, or without any known remote branch, it is the local branch; when the remote
 * cannot be reached it is the last known trunk. Each case comes with a sentence for the user.
 */
export async function latestTrunk(repoPath: string): Promise<StartPoint> {
  const remote = await remoteOf(repoPath);
  if (remote === undefined) return localStart(repoPath, "This repository has no remote");
  return fetchedTrunk(repoPath, remote).catch((error: unknown) =>
    unreachable({ cwd: repoPath, remote, error }),
  );
}
