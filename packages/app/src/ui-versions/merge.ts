import fs from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import git from "isomorphic-git";
import { commitTree, history, type Repo, tip } from "./commits.ts";
import { snapshotDir, writeToDir } from "./snapshot.ts";
import type { MergeOutcome, UiVersion } from "./types.ts";

interface ConflictError {
  code: string;
  data: { filepaths: string[] };
}

function isConflict(error: unknown): error is ConflictError {
  return (error as Partial<ConflictError> | undefined)?.code === "MergeConflictError";
}

/** The user's requests since the last default-UI commit (template or update), oldest first. */
async function keptRequests(repo: Repo): Promise<string[]> {
  const requests: string[] = [];
  for (const version of await history(repo)) {
    if (version.kind === "template" || version.kind === "update") break;
    if (version.kind === "change") requests.push(version.message);
  }
  return requests.reverse();
}

/** isomorphic-git records conflicts in the repo's index; we never use it, so drop it. */
const dropIndex = (repo: Repo) => rm(join(repo.gitdir, "index"), { force: true });

const AUTHOR = { name: "AgentControl", email: "agentcontrol@localhost" };

export async function startUpdate(repo: Repo, dir: string): Promise<MergeOutcome> {
  const { gitdir } = repo;
  const requests = await keptRequests(repo);
  await dropIndex(repo);
  try {
    const result = await git.merge({
      ...{ fs, dir, gitdir, ours: "main", theirs: "upstream", author: AUTHOR },
      ...{ fastForward: false, noUpdateBranch: true, abortOnConflict: false },
    });
    if (result.alreadyMerged)
      return { status: "up-to-date", conflictedFiles: [], keptRequests: requests };
    await writeToDir({ dir, gitdir, oid: result.oid ?? "" });
    return { status: "clean", conflictedFiles: [], keptRequests: requests };
  } catch (error) {
    if (!isConflict(error)) throw error;
    await dropIndex(repo);
    const conflictedFiles = error.data.filepaths.sort();
    return { status: "conflicts", conflictedFiles, keptRequests: requests };
  }
}

export async function finishUpdate(
  repo: Repo,
  input: { dir: string; templateVersion: string },
): Promise<UiVersion> {
  const tree = await snapshotDir({ dir: input.dir, gitdir: repo.gitdir });
  const parents = [await tip(repo, "main"), await tip(repo, "upstream")];
  const { templateVersion } = input;
  const message = `Update to default UI ${templateVersion}`;
  return commitTree(repo, { tree, kind: "update", message, templateVersion, parents });
}
