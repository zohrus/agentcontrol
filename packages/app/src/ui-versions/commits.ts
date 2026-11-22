import fs from "node:fs";
import git from "isomorphic-git";
import { formatMessage, parseMessage } from "./message.ts";
import { snapshotDir } from "./snapshot.ts";
import type { UiVersion } from "./types.ts";

export interface Repo {
  gitdir: string;
  now: () => Date;
}

type Branch = "main" | "upstream";

interface NewCommit {
  tree: string;
  kind: UiVersion["kind"];
  message: string;
  templateVersion?: string;
  /** Branch that moves to the new commit. Default `main`. */
  branch?: Branch;
  /** Default: the branch's current tip. */
  parents?: string[];
}

const AUTHOR = { name: "AgentControl", email: "agentcontrol@localhost" };

export const tip = (repo: Repo, branch: Branch) =>
  git.resolveRef({ fs, gitdir: repo.gitdir, ref: `refs/heads/${branch}` });

const read = (repo: Repo, oid: string) => git.readCommit({ fs, gitdir: repo.gitdir, oid });

export async function treeOf(repo: Repo, commit: string): Promise<string> {
  return (await read(repo, commit)).commit.tree;
}

async function toVersion(repo: Repo, oid: string): Promise<UiVersion> {
  const { commit } = await read(repo, oid);
  const createdAt = new Date(commit.committer.timestamp * 1000).toISOString();
  return { commit: oid, createdAt, ...parseMessage(commit.message) };
}

export async function commitTree(repo: Repo, input: NewCommit): Promise<UiVersion> {
  const branch = input.branch ?? "main";
  const parent = input.parents ?? [await tip(repo, branch)];
  const when = { timestamp: Math.floor(repo.now().getTime() / 1000), timezoneOffset: 0 };
  const { gitdir } = repo;
  const oid = await git.writeCommit({
    fs,
    gitdir,
    commit: {
      message: formatMessage(input),
      tree: input.tree,
      parent,
      author: { ...AUTHOR, ...when },
      committer: { ...AUTHOR, ...when },
    },
  });
  await git.writeRef({ fs, gitdir, ref: `refs/heads/${branch}`, value: oid, force: true });
  return toVersion(repo, oid);
}

/** Newest first, following first parents of `main`. */
export async function history(repo: Repo): Promise<UiVersion[]> {
  const versions: UiVersion[] = [];
  let next: string | undefined = await tip(repo, "main");
  while (next !== undefined) {
    versions.push(await toVersion(repo, next));
    next = (await read(repo, next)).commit.parent[0];
  }
  return versions;
}

interface TemplateOptions {
  templateDir: string;
  templateVersion: string;
}

async function templateCommit(repo: Repo, input: TemplateOptions, parents?: string[]) {
  const tree = await snapshotDir({ dir: input.templateDir, gitdir: repo.gitdir });
  const { templateVersion } = input;
  const message = `Default UI ${templateVersion}`;
  const base = { tree, kind: "template", message, templateVersion, branch: "upstream" } as const;
  return commitTree(repo, parents ? { ...base, parents } : base);
}

export async function init(repo: Repo, input: TemplateOptions): Promise<void> {
  const { gitdir } = repo;
  if (await git.resolveRef({ fs, gitdir, ref: "refs/heads/main" }).catch(() => undefined)) return;
  await git.init({ fs, gitdir, bare: true, defaultBranch: "main" });
  const first = await templateCommit(repo, input, []);
  await git.writeRef({ fs, gitdir, ref: "refs/heads/main", value: first.commit, force: true });
}

export async function addTemplateVersion(repo: Repo, input: TemplateOptions): Promise<void> {
  await templateCommit(repo, input);
}

/** Re-commits the content of an earlier version on top of `main`. */
export async function restore(repo: Repo, commit: string): Promise<UiVersion> {
  const old = await toVersion(repo, commit);
  const message = old.kind === "undo" ? old.message : `Restore: ${old.message}`;
  return commitTree(repo, { tree: await treeOf(repo, commit), kind: "undo", message });
}

/** A new commit whose tree is the previous version's tree. */
export async function undo(repo: Repo): Promise<UiVersion | undefined> {
  const current = await tip(repo, "main");
  const parent = (await read(repo, current)).commit.parent[0];
  if (parent === undefined) return undefined;
  const undone = (await toVersion(repo, current)).message;
  return commitTree(repo, {
    tree: await treeOf(repo, parent),
    kind: "undo",
    message: `Undo: ${undone}`,
  });
}
