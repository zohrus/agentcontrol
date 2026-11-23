// The default UI as a release ships it: the template's files and an installed node_modules (the
// user has no package manager, and the Modify agent must typecheck and build the UI). There is no
// prebuilt `dist/`: Vite serves the UI on a first start in about three seconds, so it would be
// dead weight.
import { cp, mkdir, rename, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";

const root = join(import.meta.dir, "../..");
const Manifest = z.object({
  dependencies: z.record(z.string(), z.string()).default({}),
  devDependencies: z.record(z.string(), z.string()).default({}),
});

type Versions = Record<string, string>;

async function versionsIn(name: string): Promise<Versions> {
  const path = name === "" ? "package.json" : `packages/${name}/package.json`;
  const manifest = Manifest.parse(await Bun.file(join(root, path)).json());
  return { ...manifest.dependencies, ...manifest.devDependencies };
}

const FROM_REPOSITORY = ["typescript", "@types/bun", "hono", "drizzle-orm"];

/**
 * What the UI's tools and types need installed: the template's own dependencies, Hono and drizzle
 * (the app's types, which the SDK's types are made of), and the repository's TypeScript and Bun
 * types. The workspace packages are copied in instead, see `copyWorkspacePackages`.
 */
async function installedVersions(): Promise<Versions> {
  const [rootVersions = {}, template = {}, app = {}] = await Promise.all(
    ["", "ui-template", "app"].map(versionsIn),
  );
  const own = Object.entries(template).filter(([, version]) => !version.startsWith("workspace:"));
  const known = { ...app, ...rootVersions };
  const shared = FROM_REPOSITORY.map((name) => [name, known[name] ?? ""] as const);
  return { ...Object.fromEntries(own), ...Object.fromEntries(shared) };
}

/** `bun install` for another platform than this one, so a Linux machine can build the Mac release. */
async function install(options: { platform: string; folder: string }): Promise<void> {
  const [os = "", cpu = ""] = options.platform.split("-");
  await mkdir(options.folder, { recursive: true });
  const manifest = { name: "ui-resources", private: true, dependencies: await installedVersions() };
  await Bun.write(join(options.folder, "package.json"), JSON.stringify(manifest, null, 2));
  const run = Bun.spawnSync(
    ["bun", "install", "--linker", "hoisted", "--ignore-scripts", "--os", os, "--cpu", cpu],
    { cwd: options.folder, stdout: "pipe", stderr: "pipe" },
  );
  if (run.exitCode !== 0) throw new Error(`bun install failed:\n${run.stderr.toString()}`);
}

/**
 * The SDK and the protocol are workspace packages, so they are copied in as plain folders (their
 * sources, which Vite and tsc read as they are). The app is only there for its types, which the
 * SDK's types are made of: its declaration files, so tsc need not check the whole app each time.
 */
async function copyWorkspacePackages(options: {
  modules: string;
  appTypes: string;
}): Promise<void> {
  for (const name of ["protocol", "sdk"]) {
    const target = join(options.modules, "@agentcontrol", name);
    await mkdir(target, { recursive: true });
    await cp(join(root, "packages", name, "package.json"), join(target, "package.json"));
    await cp(join(root, "packages", name, "src"), join(target, "src"), { recursive: true });
  }
  const app = join(options.modules, "@agentcontrol", "app");
  const types = { ".": { types: "./src/index.d.ts" } };
  await mkdir(app, { recursive: true });
  await Bun.write(
    join(app, "package.json"),
    JSON.stringify({ name: "@agentcontrol/app", type: "module", exports: types }),
  );
  await cp(join(options.appTypes, "app", "src"), join(app, "src"), { recursive: true });
}

function runWithBun(args: string[], cwd: string): void {
  const run = Bun.spawnSync([process.execPath, ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  if (run.exitCode !== 0) throw new Error(`${args.join(" ")} failed:\n${run.stdout.toString()}`);
}

/** What does not depend on the platform, made once: the app's type declarations. */
export interface SharedUiParts {
  appTypes: string;
}

/** Writes the app's declaration files, with this machine's TypeScript. */
export function buildSharedUiParts(into: string): SharedUiParts {
  const tsc = join(root, "node_modules/typescript/bin/tsc");
  const appTypes = resolve(into, "app-types");
  runWithBun([tsc, "-p", "scripts/build/app-types.tsconfig.json", "--outDir", appTypes], root);
  return { appTypes };
}

const NOT_TEMPLATE = new Set(["node_modules", "dist", ".vite"]);

/** Writes `<resources>/ui-template` for one platform: sources and node_modules. */
export async function writeUiResources(options: {
  platform: string;
  resources: string;
  shared: SharedUiParts;
}): Promise<void> {
  const target = join(options.resources, "ui-template");
  const scratch = join(options.resources, ".install");
  await rm(target, { recursive: true, force: true });
  await rm(scratch, { recursive: true, force: true });
  await cp(join(root, "packages/ui-template"), target, {
    recursive: true,
    filter: (source) => !NOT_TEMPLATE.has(source.slice(source.lastIndexOf("/") + 1)),
  });
  await install({ platform: options.platform, folder: scratch });
  // A move, not a copy: copying turns the links inside node_modules into absolute ones.
  await rename(join(scratch, "node_modules"), join(target, "node_modules"));
  await rm(scratch, { recursive: true, force: true });
  await rm(join(target, "node_modules", ".bin"), { recursive: true, force: true });
  const modules = join(target, "node_modules");
  await copyWorkspacePackages({ modules, appTypes: options.shared.appTypes });
}
