import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  type Adapter,
  adapterFolder,
  adaptersRoot,
  downloadFailed,
  unreadable,
} from "./adapters.ts";
import { agentEnvironment } from "./environment.ts";
import type { HostEnv } from "./types.ts";

const TEMP_PREFIX = ".installing-";
/** A half-made install older than this was left by a relay that died; nobody is still using it. */
const STALE_MS = 60 * 60 * 1000;

const PackageJson = z.looseObject({ bin: z.record(z.string(), z.string()) });

/** The adapter's entry file inside its install folder, from the `bin` its package.json declares. */
async function entryOf(options: { adapter: Adapter; folder: string }): Promise<string> {
  const { adapter, folder } = options;
  const packageFolder = join(folder, "node_modules", adapter.package);
  const { bin } = PackageJson.parse(await Bun.file(join(packageFolder, "package.json")).json());
  const relative = bin[adapter.bin];
  if (relative === undefined) throw new Error(`the package has no "${adapter.bin}" executable`);
  return join(packageFolder, relative);
}

/** Removes half-made installs that an earlier, killed relay left behind. */
async function removeStaleInstalls(root: string): Promise<void> {
  const leftovers = (await readdir(root)).filter((name) => name.startsWith(TEMP_PREFIX));
  for (const name of leftovers) {
    const found = await stat(join(root, name)).catch(() => undefined);
    const stale = found !== undefined && Date.now() - found.mtimeMs > STALE_MS;
    if (stale) await rm(join(root, name), { recursive: true, force: true });
  }
}

/**
 * Runs `bun install` in the folder with this binary acting as `bun` (set only for this child, which
 * ends before the agent starts), and a package cache inside the folder that is removed afterwards.
 */
async function runInstall(options: { folder: string; env: HostEnv }): Promise<void> {
  const { folder, env } = options;
  const child = Bun.spawn([process.execPath, "install", "--linker", "hoisted"], {
    cwd: folder,
    env: {
      ...agentEnvironment(env),
      BUN_BE_BUN: "1",
      BUN_INSTALL_CACHE_DIR: join(folder, ".cache"),
    },
    stdin: "ignore",
    stdout: "ignore",
    stderr: "pipe",
  });
  const [stderr, exitCode] = await Promise.all([new Response(child.stderr).text(), child.exited]);
  if (exitCode !== 0) throw new Error(stderr.trim().split("\n").slice(-5).join("\n"));
  await rm(join(folder, ".cache"), { recursive: true, force: true });
}

/** Installs into a temporary folder, then renames it into place, so no one sees half an install. */
async function install(options: { adapter: Adapter; root: string; env: HostEnv }): Promise<void> {
  const { adapter, root, env } = options;
  const temporary = join(root, `${TEMP_PREFIX}${randomUUID()}`);
  await mkdir(temporary, { recursive: true });
  try {
    const dependencies = { [adapter.package]: adapter.version };
    await Bun.write(
      join(temporary, "package.json"),
      JSON.stringify({ private: true, dependencies }),
    );
    await runInstall({ folder: temporary, env });
    await rename(temporary, adapterFolder({ adapter, root })).catch((error: unknown) => {
      // Another relay put the same version in place first: use that one.
      if (!existsSync(adapterFolder({ adapter, root }))) throw error;
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function ensureInstalled(options: {
  adapter: Adapter;
  root: string;
  env: HostEnv;
}): Promise<string> {
  const folder = adapterFolder(options);
  if (!existsSync(folder)) await downloadInto(options);
  return entryOf({ adapter: options.adapter, folder }).catch((error: unknown) => {
    throw new Error(unreadable({ adapter: options.adapter, folder, reason: reasonOf(error) }));
  });
}

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** The install, whose failure is told as a failed download (the network is the usual cause). */
async function downloadInto(options: { adapter: Adapter; root: string; env: HostEnv }) {
  await mkdir(options.root, { recursive: true });
  await removeStaleInstalls(options.root);
  await install(options).catch((error: unknown) => {
    throw new Error(downloadFailed({ adapter: options.adapter, reason: reasonOf(error) }));
  });
}

/** Installs in progress in this process, so sessions that start together install once. */
const inProgress = new Map<string, Promise<string>>();

/**
 * The entry file of the adapter, installing it first when it is not in the relay's folder yet (this
 * is the only time it needs the internet). A failed install says what to do and leaves nothing.
 */
export function installedAdapterEntry(options: {
  adapter: Adapter;
  env: HostEnv;
}): Promise<string> {
  const { adapter, env } = options;
  const root = adaptersRoot(env);
  const key = adapterFolder({ adapter, root });
  const running = inProgress.get(key);
  if (running !== undefined) return running;
  const started = ensureInstalled({ adapter, root, env }).finally(() => inProgress.delete(key));
  inProgress.set(key, started);
  return started;
}
