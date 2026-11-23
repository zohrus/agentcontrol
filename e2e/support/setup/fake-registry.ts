import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A package the fake registry serves: what `bun install` of this name and version fetches. */
export interface FakePackage {
  name: string;
  version: string;
  /** The executable the package declares, and the code in its entry file. */
  bin: string;
  entrySource: string;
}

/** A package registry on this machine, so a test can install adapters without the internet. */
export interface FakeRegistry {
  /** Set as the registry's address (`NPM_CONFIG_REGISTRY`) for whatever installs from it. */
  readonly url: string;
  /** How many times a package file was downloaded. */
  readonly downloads: () => number;
  stop(): void;
}

async function tarballOf(pkg: FakePackage): Promise<Uint8Array> {
  const work = await mkdtemp(join(tmpdir(), "agentcontrol-fake-package-"));
  try {
    const folder = join(work, "package");
    await mkdir(folder);
    const manifest = {
      name: pkg.name,
      version: pkg.version,
      type: "module",
      bin: { [pkg.bin]: "index.js" },
    };
    await Bun.write(join(folder, "package.json"), JSON.stringify(manifest));
    await Bun.write(join(folder, "index.js"), pkg.entrySource);
    const made = Bun.spawnSync(["tar", "czf", "package.tgz", "package"], { cwd: work });
    if (!made.success)
      throw new Error(`could not pack the fake package: ${made.stderr.toString()}`);
    return new Uint8Array(await readFile(join(work, "package.tgz")));
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

function metadataOf(options: { pkg: FakePackage; tarball: Uint8Array; origin: string }) {
  const { pkg, tarball, origin } = options;
  const file = `${pkg.name.split("/").pop() ?? pkg.name}-${pkg.version}.tgz`;
  const version = {
    name: pkg.name,
    version: pkg.version,
    bin: { [pkg.bin]: "index.js" },
    dist: {
      tarball: `${origin}/files/${file}`,
      shasum: createHash("sha1").update(tarball).digest("hex"),
    },
  };
  return {
    name: pkg.name,
    "dist-tags": { latest: pkg.version },
    versions: { [pkg.version]: version },
  };
}

/** Serves one package. A package file takes `slowMs` to download, so that installs overlap. */
export async function startFakeRegistry(options: {
  pkg: FakePackage;
  slowMs?: number;
}): Promise<FakeRegistry> {
  const { pkg, slowMs = 0 } = options;
  const tarball = await tarballOf(pkg);
  let downloads = 0;
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request): Promise<Response> {
      const { pathname, origin } = new URL(request.url);
      if (!pathname.startsWith("/files/")) {
        return Response.json(metadataOf({ pkg, tarball, origin }));
      }
      downloads += 1;
      await Bun.sleep(slowMs);
      return new Response(tarball);
    },
  });
  const registry: FakeRegistry = {
    url: `http://127.0.0.1:${String(server.port)}/`,
    downloads: () => downloads,
    stop: () => {
      void server.stop(true);
    },
  };
  return registry;
}
