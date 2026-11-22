import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, readdir, readFile, realpath, rm } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

/** Maps a relative posix path to the SHA-256 of the file's content. */
type Fingerprint = Map<string, string>;

/** node_modules, build output and dot-folders (.vite, .git, ...) are never copied or compared. */
function isSkipped(name: string): boolean {
  return name === "node_modules" || name === "dist" || name.startsWith(".");
}

export async function exists(path: string): Promise<boolean> {
  return lstat(path).then(
    () => true,
    () => false,
  );
}

async function hashFile(path: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

async function fingerprintInto(options: {
  root: string;
  rel: string;
  into: Fingerprint;
}): Promise<void> {
  const { root, rel, into } = options;
  for (const entry of await readdir(join(root, rel), { withFileTypes: true })) {
    const path = [rel, entry.name].filter(Boolean).join("/");
    if (entry.isFile()) into.set(path, await hashFile(join(root, path)));
    else if (entry.isDirectory() && !isSkipped(entry.name)) {
      await fingerprintInto({ root, rel: path, into });
    }
  }
}

/** Content hash of every tracked-eligible file of a folder (empty when the folder is missing). */
async function fingerprint(root: string): Promise<Fingerprint> {
  const into: Fingerprint = new Map();
  if (await exists(root)) await fingerprintInto({ root, rel: "", into });
  return into;
}

export interface Plan {
  /** New or changed files, relative. */
  write: string[];
  /** Files present in the target but not in the source. */
  remove: string[];
}

/** What it takes to make `to` equal `from`. */
export async function plan(options: { from: string; to: string }): Promise<Plan> {
  const [source, target] = [await fingerprint(options.from), await fingerprint(options.to)];
  return {
    write: [...source].filter(([path, hash]) => target.get(path) !== hash).map(([path]) => path),
    remove: [...target.keys()].filter((path) => !source.has(path)),
  };
}

/**
 * Makes `to` equal `from` and returns the changed paths. New and changed files are written first
 * and removed files deleted last, so an interruption never leaves the UI missing a file.
 */
export async function syncDir(options: { from: string; to: string }): Promise<string[]> {
  const { write, remove } = await plan(options);
  for (const path of write) {
    await mkdir(dirname(join(options.to, path)), { recursive: true });
    await copyFile(join(options.from, path), join(options.to, path));
  }
  for (const path of remove) await rm(join(options.to, path));
  return [...write, ...remove].sort();
}

/** Refuses a folder that is, or resolves (through symlinks), outside the data folder. */
export async function assertInside(options: { dataDir: string; dir: string }): Promise<void> {
  const base = resolve(options.dataDir);
  const real = await realpath(options.dir).catch(() => resolve(options.dir));
  const realBase = await realpath(base).catch(() => base);
  const rel = relative(realBase, real);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`UI folder ${options.dir} is outside the data folder ${options.dataDir}`);
  }
}
