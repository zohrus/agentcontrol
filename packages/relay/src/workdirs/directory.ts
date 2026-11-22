import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { ErrorCode, type FsEntry } from "@agentcontrol/protocol";
import type { z } from "zod";
import { readFileAt } from "../files/index.ts";
import { RelayError } from "../rpc/index.ts";
import type { Workdir, WorkdirInfo } from "./types.ts";

type Entry = z.infer<typeof FsEntry>;

const isHidden = (name: string): boolean => name === "node_modules" || name.startsWith(".");

async function walk(root: string, rel: string): Promise<Entry[]> {
  const items = await readdir(`${root}/${rel}`, { withFileTypes: true });
  const nested = await Promise.all(items.map((item) => entryOf({ root, rel, item })));
  return nested.flat();
}

async function entryOf(options: { root: string; rel: string; item: Dirent }): Promise<Entry[]> {
  const { root, rel, item } = options;
  const path = rel === "" ? item.name : `${rel}/${item.name}`;
  if (isHidden(item.name)) return [];
  if (item.isDirectory()) return [{ path, kind: "dir" }, ...(await walk(root, path))];
  return item.isFile() ? [{ path, kind: "file" }] : [];
}

function unavailable(what: string): RelayError {
  return new RelayError(ErrorCode.invalidParams, `${what} is not available for this session.`);
}

/** A plain folder, no git: nothing to create or remove, no diff, files are read as they are. */
export function directoryWorkdir(info: WorkdirInfo): Workdir {
  const root = info.worktreePath;
  return {
    tree: async () => ({
      entries: (await walk(root, "")).sort((a, b) => a.path.localeCompare(b.path)),
    }),
    read: ({ path, ref }) => {
      if (ref !== "working") return Promise.reject(unavailable("An earlier version of a file"));
      return readFileAt({ worktreePath: root, baseBranch: "", path, ref });
    },
    diff: () => Promise.reject(unavailable("A diff")),
    uncommitted: () => Promise.resolve([]),
    remove: () => Promise.resolve(),
  };
}
