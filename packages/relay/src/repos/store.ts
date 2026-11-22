import { realpath } from "node:fs/promises";
import { join } from "node:path";
import { RepoId, type RepoInfo, type RepoSetup } from "@agentcontrol/protocol";
import { git, runGit } from "../git/index.ts";

export type RepoWithSetup = RepoInfo & { setup: RepoSetup };

export interface RepoStore {
  add(path: string): Promise<RepoWithSetup>;
  list(): Promise<RepoWithSetup[]>;
  setSetup(repoId: string, setup: RepoSetup): Promise<void>;
  get(repoId: string): Promise<RepoWithSetup | undefined>;
  findByPath(path: string): Promise<RepoWithSetup | undefined>;
}

async function detectDefaultBranch(cwd: string): Promise<string> {
  const remote = await runGit(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], { cwd });
  if (remote.exitCode === 0) return remote.stdout.trim().replace(/^origin\//, "");
  return (await git(["symbolic-ref", "--short", "HEAD"], { cwd })).trim();
}

async function gitRoot(path: string): Promise<string> {
  const result = await runGit(["rev-parse", "--show-toplevel"], { cwd: await realpath(path) });
  if (result.exitCode !== 0) throw new Error(`"${path}" is not a git repository.`);
  return result.stdout.trim();
}

/** Validates the folder is a git repo and builds its record with the default setup. */
async function newRepo(path: string): Promise<RepoWithSetup> {
  const root = await gitRoot(path);
  const defaultBranch = await detectDefaultBranch(root);
  return {
    repoId: RepoId.parse(crypto.randomUUID()),
    path: root,
    defaultBranch,
    setup: { copyFiles: [".env*"] },
  };
}

async function load(file: string): Promise<RepoWithSetup[]> {
  const stored = Bun.file(file);
  if (!(await stored.exists())) return [];
  return (await stored.json()) as RepoWithSetup[];
}

async function addTo(file: string, path: string): Promise<RepoWithSetup> {
  const repos = await load(file);
  const repo = await newRepo(path);
  const existing = repos.find((item) => item.path === repo.path);
  if (existing) return existing;
  await Bun.write(file, JSON.stringify([...repos, repo], null, 2));
  return repo;
}

async function setSetupIn(file: string, repoId: string, setup: RepoSetup): Promise<void> {
  const repos = await load(file);
  if (!repos.some((repo) => repo.repoId === repoId)) {
    throw new Error("That repo is not registered.");
  }
  const updated = repos.map((repo) => (repo.repoId === repoId ? { ...repo, setup } : repo));
  await Bun.write(file, JSON.stringify(updated, null, 2));
}

/** A tiny JSON-file store of repos at <dataDir>/repos.json; writes run one at a time. */
export function createRepoStore(options: { dataDir: string }): RepoStore {
  const file = join(options.dataDir, "repos.json");
  let queue: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task);
    queue = run.catch(() => undefined);
    return run;
  };
  const find = async (match: (repo: RepoWithSetup) => boolean) => (await load(file)).find(match);
  return {
    add: (path) => exclusive(() => addTo(file, path)),
    list: () => load(file),
    get: (repoId) => find((repo) => repo.repoId === repoId),
    findByPath: async (path) => {
      const root = await realpath(path).catch(() => path);
      return find((repo) => repo.path === root);
    },
    setSetup: (repoId, setup) => exclusive(() => setSetupIn(file, repoId, setup)),
  };
}
