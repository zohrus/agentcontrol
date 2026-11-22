import fs from "node:fs";
import git from "isomorphic-git";
import {
  addTemplateVersion,
  commitTree,
  history,
  init,
  type Repo,
  restore,
  tip,
  treeOf,
  undo,
} from "./commits.ts";
import { finishUpdate, startUpdate } from "./merge.ts";
import type { MergeOutcome, UiVersion } from "./types.ts";
import { type Files, readFiles, snapshotDir, writeToDir } from "./snapshot.ts";

export type { MergeOutcome, UiVersion } from "./types.ts";

export interface UiVersions {
  /** First run: commits the default UI found in templateDir onto `upstream` and creates `main` from it. No-op when the repo exists. */
  init(options: { templateDir: string; templateVersion: string }): Promise<void>;
  /** Writes the tip of `main` into dir (replacing its tracked content; build output is left alone). */
  checkout(dir: string): Promise<void>;
  /** Keep: commits the content of dir onto `main` with the user's request as the message. Undefined when nothing changed. */
  keep(options: { dir: string; request: string }): Promise<UiVersion | undefined>;
  /** Undo: a new commit on `main` whose tree equals the previous version's tree. Undefined when there is nothing to undo. */
  undo(): Promise<UiVersion | undefined>;
  /** Restores any earlier version as a new commit on `main`. */
  restore(commit: string): Promise<UiVersion>;
  /** Newest first, `main` only (first parents). */
  history(): Promise<UiVersion[]>;
  /** Commits a new default UI onto `upstream`. */
  addTemplateVersion(options: { templateDir: string; templateVersion: string }): Promise<void>;
  /** Merges `upstream` into `main` inside dir (which holds main's content). Clean: merged files are in dir, uncommitted. Conflicts: conflict markers are left in dir. */
  startUpdate(dir: string): Promise<MergeOutcome>;
  /** Commits the (resolved) content of dir as the merge commit on `main`, with both parents. */
  finishUpdate(options: { dir: string; templateVersion: string }): Promise<UiVersion>;
  /** Files that differ between two versions, with their content on both sides. */
  diff(options: {
    from: string;
    to: string;
  }): Promise<{ path: string; before?: string; after?: string }[]>;
}

async function textOf(gitdir: string, oid: string | undefined): Promise<string | undefined> {
  if (oid === undefined) return undefined;
  const { blob } = await git.readBlob({ fs, gitdir, oid });
  return new TextDecoder().decode(blob);
}

async function diffVersions(gitdir: string, options: { from: string; to: string }) {
  const before: Files = await readFiles(gitdir, options.from);
  const after: Files = await readFiles(gitdir, options.to);
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
  const changed = paths.filter((path) => before.get(path) !== after.get(path));
  return Promise.all(
    changed.map(async (path) => {
      const [was, now] = [
        await textOf(gitdir, before.get(path)),
        await textOf(gitdir, after.get(path)),
      ];
      return {
        path,
        ...(was === undefined ? {} : { before: was }),
        ...(now === undefined ? {} : { after: now }),
      };
    }),
  );
}

export function createUiVersions(options: { gitDir: string; now: () => Date }): UiVersions {
  const repo: Repo = { gitdir: options.gitDir, now: options.now };
  const { gitdir } = repo;
  return {
    init: (input) => init(repo, input),
    addTemplateVersion: (input) => addTemplateVersion(repo, input),
    undo: () => undo(repo),
    restore: (commit) => restore(repo, commit),
    history: () => history(repo),
    startUpdate: (dir) => startUpdate(repo, dir),
    finishUpdate: (input) => finishUpdate(repo, input),
    checkout: async (dir) => writeToDir({ dir, gitdir, oid: await tip(repo, "main") }),
    keep: async ({ dir, request }) => {
      const tree = await snapshotDir({ dir, gitdir });
      if (tree === (await treeOf(repo, await tip(repo, "main")))) return undefined;
      return commitTree(repo, { tree, kind: "change", message: request });
    },
    diff: (pair) => diffVersions(gitdir, pair),
  };
}
