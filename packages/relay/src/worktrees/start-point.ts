import { git, runGit } from "../git/index.ts";
import type { Timed } from "../steps/index.ts";

/** What a new session's worktree starts from, and what to tell the user about it. */
export interface StartPoint {
  /** A branch or commit git understands, e.g. "origin/main". Stored as the session's base. */
  ref: string;
  /** Plain sentences for the session's setup output. */
  notes: string[];
}

const NETWORK_MS = 15_000;

/** Options for a command that talks to a remote: never wait for a password, never wait forever. */
const network = (cwd: string) => ({
  cwd,
  env: { GIT_TERMINAL_PROMPT: "0" },
  timeoutMs: NETWORK_MS,
});

const reasonOf = (error: unknown): string => {
  const text = error instanceof Error ? error.message : String(error);
  const line = text.split("\n").find((part) => part.trim() !== "") ?? text;
  const reason = line.replace(/^git \w+ failed: /, "").replace(/^fatal: /, "");
  return reason === "" ? "it did not answer in time" : reason;
};

export async function refExists(cwd: string, ref: string): Promise<boolean> {
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

/** Fetches just that branch of the remote into its remote-tracking branch. */
async function fetchTrunk(cwd: string, call: { remote: string; trunk: string }): Promise<void> {
  const { remote, trunk } = call;
  await git(
    ["fetch", remote, `+refs/heads/${trunk}:refs/remotes/${remote}/${trunk}`],
    network(cwd),
  );
}

/**
 * The branch the remote most likely has as its trunk, from what the repository knew last time. It
 * is only a guess, used to start the fetch while the remote is still being asked: the answer of
 * the remote decides which branch is used.
 */
async function guessedTrunk(cwd: string, remote: string): Promise<string | undefined> {
  const known = await lastKnownTrunk(cwd, remote);
  return known?.startsWith(`${remote}/`) ? known.slice(remote.length + 1) : undefined;
}

/** Fetches the guess in the background; true when it worked. A wrong guess is no failure. */
function fetchGuess(cwd: string, call: { remote: string; guess: string | undefined }) {
  const { remote, guess } = call;
  if (guess === undefined) return Promise.resolve(false);
  return fetchTrunk(cwd, { remote, trunk: guess }).then(
    () => true,
    () => false,
  );
}

/** Asks the remote for its trunk while the guess is already being fetched; fetches the answer if it differs. */
async function fetchedTrunk(call: {
  cwd: string;
  remote: string;
  timed: Timed;
}): Promise<StartPoint> {
  const { cwd, remote, timed } = call;
  const guess = await guessedTrunk(cwd, remote);
  const guessFetched = fetchGuess(cwd, { remote, guess });
  const trunk = await timed(
    {
      id: "trunk",
      doing: `Asking ${remote} for its default branch`,
      done: (name: string) => `Asked ${remote}: its default branch is ${name}`,
    },
    () => liveTrunk(cwd, remote),
  );
  const ref = `${remote}/${trunk}`;
  await timed({ id: "fetch", doing: `Fetching ${ref}`, done: `Fetched ${ref}` }, async () => {
    if (trunk === guess && (await guessFetched)) return;
    await fetchTrunk(cwd, { remote, trunk });
  });
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
export async function latestTrunk(options: {
  repoPath: string;
  timed: Timed;
}): Promise<StartPoint> {
  const { repoPath: cwd, timed } = options;
  const remote = await remoteOf(cwd);
  if (remote === undefined) return localStart(cwd, "This repository has no remote");
  return fetchedTrunk({ cwd, remote, timed }).catch((error: unknown) =>
    unreachable({ cwd, remote, error }),
  );
}
