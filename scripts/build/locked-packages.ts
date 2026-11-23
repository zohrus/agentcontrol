// Packages that the repository installed from its lock file, copied (with what they depend on)
// into the release instead of being resolved again. They are plain JavaScript or type
// declarations, the same on every platform, so the lock's choice is the one that ships, and the
// repository's release-age rule is never needed to second-guess a version the lock has accepted.
import { existsSync } from "node:fs";
import { cp, mkdir, realpath } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";

const root = join(import.meta.dir, "../..");
const Manifest = z.object({ dependencies: z.record(z.string(), z.string()).default({}) });

/** Where the repository's workspaces keep the packages they installed. */
const installFolders = [join(root, "node_modules"), join(root, "packages/app/node_modules")];

/** The folder a package's own dependencies are installed next to (isolated installs nest them). */
function siblingsOf(name: string, real: string): string {
  return name.startsWith("@") ? dirname(dirname(real)) : dirname(real);
}

async function copyOne(options: {
  name: string;
  lookIn: string[];
  into: string;
  done: Set<string>;
}): Promise<void> {
  const { name, into, done } = options;
  if (done.has(name)) return;
  done.add(name);
  const found = options.lookIn.find((folder) => existsSync(join(folder, name)));
  if (found === undefined) throw new Error(`${name} is not installed; run bun install first.`);
  const real = await realpath(join(found, name));
  await mkdir(dirname(join(into, name)), { recursive: true });
  await cp(real, join(into, name), { recursive: true });
  const manifest = Manifest.parse(await Bun.file(join(real, "package.json")).json());
  const lookIn = [siblingsOf(name, real), ...installFolders];
  for (const dependency of Object.keys(manifest.dependencies)) {
    await copyOne({ name: dependency, lookIn, into, done });
  }
}

/** Copies these packages and their dependencies from the repository's install into `into`. */
export async function copyLockedPackages(options: {
  names: string[];
  into: string;
}): Promise<void> {
  const done = new Set<string>();
  for (const name of options.names) {
    await copyOne({ name, lookIn: installFolders, into: options.into, done });
  }
}
