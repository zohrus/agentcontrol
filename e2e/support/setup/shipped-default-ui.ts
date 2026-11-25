import { cp, mkdir, rename, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { temporaryFolder } from "./release-folder.ts";

const repository = join(import.meta.dir, "../../..");
const uiPackage = join(repository, "packages/ui-template");
/** The packages whose sources the built default UI is made of. */
const SOURCES = ["packages/ui-template", "packages/sdk", "packages/protocol"];
const SKIPPED = /(^|\/)(node_modules|dist|\.vite)(\/|$)/;
const cacheRoot = join(repository, "node_modules/.cache/e2e-default-ui");

/** A digest of every source the default UI is built from: a new one means a new build is needed. */
async function digestOfSources(): Promise<string> {
  const hash = new Bun.CryptoHasher("sha256");
  for (const folder of SOURCES) {
    const glob = new Bun.Glob("**/*");
    const found = await Array.fromAsync(glob.scan({ cwd: join(repository, folder), dot: true }));
    for (const path of found.filter((name) => !SKIPPED.test(name)).sort()) {
      hash
        .update(`${folder}/${path}\0`)
        .update(await Bun.file(join(repository, folder, path)).bytes());
    }
  }
  return hash.digest("hex").slice(0, 20);
}

async function buildDefaultUi(into: string): Promise<void> {
  const vite = join(uiPackage, "node_modules/vite/bin/vite.js");
  const build = Bun.spawn(["bun", vite, "build", "--outDir", into, "--emptyOutDir"], {
    cwd: uiPackage,
    env: { ...Bun.env, NODE_ENV: "production" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err] = await Promise.all([
    new Response(build.stdout).text(),
    new Response(build.stderr).text(),
  ]);
  if ((await build.exited) !== 0) throw new Error(`building the default UI failed:\n${out}${err}`);
}

/**
 * The real default UI, built once for as long as its sources stay the same (the build is kept in
 * node_modules/.cache). A release ships exactly this: the built files next to the sources.
 */
async function theBuiltDefaultUi(): Promise<string> {
  const finished = join(cacheRoot, await digestOfSources());
  if (await Bun.file(join(finished, "index.html")).exists()) return finished;
  await mkdir(cacheRoot, { recursive: true });
  const partial = `${finished}.${String(process.pid)}.partial`;
  await buildDefaultUi(partial);
  // A test file that built it at the same moment may have been faster: its build is as good.
  await rename(partial, finished).catch(() => rm(partial, { recursive: true, force: true }));
  return finished;
}

/**
 * A copy of the default UI as a release folder holds it: the sources, the dependencies (linked),
 * and the built UI as `dist`. The app finds that build and serves it at once on a first start.
 */
export async function aDefaultUiFolderThatShipsItsBuild(): Promise<string> {
  const built = await theBuiltDefaultUi();
  const folder = await temporaryFolder("agentcontrol-shipped-ui-");
  await cp(uiPackage, folder, {
    recursive: true,
    filter: (source) => !SKIPPED.test(source.slice(uiPackage.length)),
  });
  await symlink(join(uiPackage, "node_modules"), join(folder, "node_modules"), "dir");
  await cp(built, join(folder, "dist"), { recursive: true });
  return folder;
}
