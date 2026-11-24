import { statSync } from "node:fs";
import { join } from "node:path";

export interface ManifestFile {
  name: string;
  bytes: number;
  sha256: string;
}

/** Reads size and sha256 of each named file in `dir`. */
export async function describeFiles(dir: string, names: string[]): Promise<ManifestFile[]> {
  return Promise.all(
    names.map(async (name) => {
      const path = join(dir, name);
      const hasher = new Bun.CryptoHasher("sha256");
      hasher.update(await Bun.file(path).arrayBuffer());
      return { name, bytes: statSync(path).size, sha256: hasher.digest("hex") };
    }),
  );
}

/**
 * Writes dist/manifest.json, which the release attaches next to the binaries. `buildId` says which
 * code they were built from, so an app run from source can tell that a binary in dist/ is stale.
 */
export async function writeManifest(options: {
  dir: string;
  version: string;
  buildId: string;
  files: ManifestFile[];
}): Promise<void> {
  const { dir, version, buildId, files } = options;
  const text = JSON.stringify({ version, buildId, files }, null, 2);
  await Bun.write(join(dir, "manifest.json"), `${text}\n`);
}

/** A plain-text table of names, sizes in MB and the start of each hash. */
export function formatTable(files: ManifestFile[]): string {
  const width = Math.max(0, ...files.map((file) => file.name.length));
  return files
    .map((file) => {
      const mb = (file.bytes / 1_048_576).toFixed(1).padStart(7);
      return `${file.name.padEnd(width)}  ${mb} MB  ${file.sha256.slice(0, 12)}`;
    })
    .join("\n");
}
