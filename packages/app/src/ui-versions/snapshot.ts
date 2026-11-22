import fs from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import git, { type TreeEntry } from "isomorphic-git";

/** Maps a file path (posix, relative to the UI folder) to its blob id. */
export type Files = Map<string, string>;

const SKIPPED_DIRS = new Set(["node_modules", "dist"]);

/** Build output and dot-folders (.vite, .git, ...) never belong in the history. */
function isSkippedDir(name: string): boolean {
  return SKIPPED_DIRS.has(name) || name.startsWith(".");
}

async function listEntry(dir: string, rel: string, entry: fs.Dirent): Promise<string[]> {
  const path = rel === "" ? entry.name : `${rel}/${entry.name}`;
  if (entry.isDirectory()) return isSkippedDir(entry.name) ? [] : listFiles(dir, path);
  return entry.isFile() ? [path] : [];
}

/** Tracked-eligible files of a folder, relative and sorted. */
async function listFiles(dir: string, rel = ""): Promise<string[]> {
  const entries = await readdir(join(dir, rel), { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => listEntry(dir, rel, entry)));
  return nested.flat().sort();
}

function groupByDirectory(files: Files): { blobs: Files; dirs: Map<string, Files> } {
  const blobs: Files = new Map();
  const dirs = new Map<string, Files>();
  for (const [path, oid] of files) {
    const slash = path.indexOf("/");
    if (slash < 0) blobs.set(path, oid);
    else {
      const name = path.slice(0, slash);
      const group = dirs.get(name) ?? new Map<string, string>();
      group.set(path.slice(slash + 1), oid);
      dirs.set(name, group);
    }
  }
  return { blobs, dirs };
}

/** Writes the tree objects for a flat file map and returns the root tree id. */
async function writeTree(gitdir: string, files: Files): Promise<string> {
  const { blobs, dirs } = groupByDirectory(files);
  const tree: TreeEntry[] = [...blobs].map(([path, oid]) => ({
    mode: "100644",
    path,
    oid,
    type: "blob",
  }));
  for (const [path, group] of dirs) {
    tree.push({ mode: "040000", path, oid: await writeTree(gitdir, group), type: "tree" });
  }
  return git.writeTree({ fs, gitdir, tree });
}

/** Stores the content of a folder as a tree and returns its id. */
export async function snapshotDir(options: { dir: string; gitdir: string }): Promise<string> {
  const { dir, gitdir } = options;
  const files: Files = new Map();
  for (const path of await listFiles(dir)) {
    const object = new Uint8Array(await readFile(join(dir, path)));
    files.set(path, await git.writeBlob({ fs, gitdir, blob: object }));
  }
  return writeTree(gitdir, files);
}

function joinPath(prefix: string, name: string): string {
  return prefix === "" ? name : `${prefix}/${name}`;
}

/** Every file of a commit or tree, recursively. */
export async function readFiles(gitdir: string, oid: string, prefix = ""): Promise<Files> {
  const { tree } = await git.readTree({ fs, gitdir, oid });
  const files: Files = new Map();
  for (const entry of tree) {
    const path = joinPath(prefix, entry.path);
    const found =
      entry.type === "tree"
        ? await readFiles(gitdir, entry.oid, path)
        : new Map([[path, entry.oid]]);
    for (const [name, blob] of found) files.set(name, blob);
  }
  return files;
}

/** Makes a folder's tracked content equal to a commit or tree; build output is left alone. */
export async function writeToDir(options: {
  dir: string;
  gitdir: string;
  oid: string;
}): Promise<void> {
  const { dir, gitdir, oid } = options;
  const files = await readFiles(gitdir, oid);
  await mkdir(dir, { recursive: true });
  for (const path of await listFiles(dir)) {
    if (!files.has(path)) await rm(join(dir, path));
  }
  for (const [path, blob] of files) {
    const { blob: content } = await git.readBlob({ fs, gitdir, oid: blob });
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), content);
  }
}
