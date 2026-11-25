import { cp, mkdir, readdir, rename, rm, stat, utimes } from "node:fs/promises";
import { join } from "node:path";
import { contentKey } from "../ui-workspace/index.ts";
import { type RunningBuilds, viteBuild } from "./vite-build.ts";

/** How many builds are kept: the one served and the ones a rollback is most likely to want. */
const KEEP_BUILDS = 3;
const PARTIAL = ".partial";

/** What a build of a folder came to; `key` names the build of that folder's content. */
export interface BuildResult {
  key: string;
  ok: boolean;
  output: string;
}

/**
 * The folder `<dataDir>/ui-build`: one finished build per content key, each in a folder of its
 * own. A build is written beside its place and renamed into it, so a folder that has its name is
 * complete. Equal content is built once, whoever asks.
 */
export interface BuildCache {
  keyOf(dir: string): Promise<string>;
  has(key: string): Promise<boolean>;
  dirOf(key: string): string;
  /** The key of the build used or made last, if there is one. */
  newest(): Promise<string | undefined>;
  /** Builds the UI in `dir` unless its content has a build already. Never throws. */
  build(dir: string): Promise<BuildResult>;
  /** Files a folder that was built elsewhere (the release's prebuilt UI) under a key. */
  adopt(options: { key: string; from: string }): Promise<void>;
  /** Notes that a build is served, and deletes the oldest ones beyond the few that are kept. */
  used(key: string): Promise<void>;
  /** Deletes what builds that never finished left behind; call it when no build is running. */
  clean(): Promise<void>;
  /** Ends the builds that are running, and refuses any other from then on. */
  stop(): void;
}

export async function isDir(path: string): Promise<boolean> {
  return stat(path).then(
    (info) => info.isDirectory(),
    () => false,
  );
}

/** The finished builds, newest first (a folder's time is when it was made or last used). */
async function finished(root: string): Promise<{ key: string; at: number }[]> {
  const names = await readdir(root).catch(() => []);
  const keys = names.filter((name) => !name.endsWith(PARTIAL));
  const found = await Promise.all(
    keys.map(async (key) => ({
      key,
      at: await stat(join(root, key)).then(
        (info) => info.mtimeMs,
        () => 0,
      ),
    })),
  );
  return found.sort((a, b) => b.at - a.at);
}

/** Deletes the oldest builds beyond the few that are kept. */
async function prune(root: string): Promise<void> {
  const all = await finished(root);
  for (const old of all.slice(KEEP_BUILDS)) {
    await rm(join(root, old.key), { recursive: true, force: true });
  }
}

async function clean(root: string): Promise<void> {
  for (const name of await readdir(root).catch(() => [])) {
    if (name.endsWith(PARTIAL)) await rm(join(root, name), { recursive: true, force: true });
  }
}

interface Parts {
  root: string;
  salt: string;
  running: RunningBuilds;
  inFlight: Map<string, Promise<BuildResult>>;
  stopped: boolean;
}

const keyOf = (parts: Parts, dir: string) => contentKey({ dir, salt: parts.salt });
const dirOf = (parts: Parts, key: string) => join(parts.root, key);

/** Runs Vite into a folder beside the build's place; the first failure to build says why. */
async function runVite(parts: Parts, call: { dir: string; key: string; partial: string }) {
  const { dir, key, partial } = call;
  await mkdir(parts.root, { recursive: true });
  await rm(partial, { recursive: true, force: true });
  // Hashing the folder took time: the app may have started to quit meanwhile.
  if (parts.stopped) return { ok: false, output: "The app is quitting." };
  const result = await viteBuild({ dir, outDir: partial, running: parts.running });
  // Files edited while Vite read them would make a build that fits no key.
  const changed = result.ok && (await keyOf(parts, dir)) !== key;
  return changed
    ? { ok: false, output: "The UI files changed while the UI was being built." }
    : result;
}

async function make(parts: Parts, call: { dir: string; key: string }): Promise<BuildResult> {
  const { key } = call;
  const partial = join(parts.root, key + PARTIAL);
  const result = await runVite(parts, { ...call, partial });
  if (!result.ok) await rm(partial, { recursive: true, force: true });
  else await rename(partial, dirOf(parts, key));
  return { key, ...result };
}

async function buildOnce(parts: Parts, dir: string): Promise<BuildResult> {
  if (parts.stopped) throw new Error("The app is quitting.");
  const key = await keyOf(parts, dir);
  if (await isDir(dirOf(parts, key))) return { key, ok: true, output: "" };
  const started = parts.inFlight.get(key) ?? make(parts, { dir, key });
  parts.inFlight.set(key, started);
  return started.finally(() => parts.inFlight.delete(key));
}

async function adopt(parts: Parts, call: { key: string; from: string }): Promise<void> {
  const partial = join(parts.root, call.key + PARTIAL);
  await mkdir(parts.root, { recursive: true });
  await cp(call.from, partial, { recursive: true });
  await rename(partial, dirOf(parts, call.key));
}

async function used(parts: Parts, key: string): Promise<void> {
  const now = new Date();
  await utimes(dirOf(parts, key), now, now);
  await prune(parts.root);
}

export function createBuildCache(options: { root: string; salt: string }): BuildCache {
  const parts: Parts = { ...options, running: new Set(), inFlight: new Map(), stopped: false };
  return {
    keyOf: (dir) => keyOf(parts, dir),
    has: (key) => isDir(dirOf(parts, key)),
    dirOf: (key) => dirOf(parts, key),
    newest: async () => (await finished(parts.root))[0]?.key,
    build: (dir) =>
      buildOnce(parts, dir).catch((error: unknown) => ({
        key: "",
        ok: false,
        output: String(error),
      })),
    adopt: (call) => adopt(parts, call),
    used: (key) => used(parts, key),
    clean: () => clean(parts.root),
    stop: () => {
      parts.stopped = true;
      for (const child of parts.running) child.kill();
    },
  };
}
