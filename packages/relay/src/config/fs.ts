import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, realpath, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ConfigCtx } from "./types.ts";

export const sha256 = (data: string | Uint8Array): string =>
  createHash("sha256").update(data).digest("hex");

/** Only "no such file" means the file is absent; any other read error must not look like that. */
export const isMissing = (error: unknown): boolean =>
  error instanceof Error &&
  "code" in error &&
  (error.code === "ENOENT" || error.code === "ENOTDIR");

export async function readText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

async function listFiles(dir: string): Promise<string[]> {
  try {
    const names = await readdir(dir, { recursive: true });
    const kinds = await Promise.all(names.map((n) => stat(join(dir, n)).catch(() => undefined)));
    return names.filter((_, i) => kinds[i]?.isFile() === true).sort();
  } catch {
    return [];
  }
}

export function makeCtx(input: { homeDir: string; repoPath?: string | undefined }): ConfigCtx {
  return { ...input, readFile: readText, listFiles };
}

/** Write through a temp file and a rename; keeps the permissions of an existing file. */
export async function writeAtomic(link: string, data: string | Uint8Array): Promise<void> {
  const path = await realpath(link).catch(() => link);
  await mkdir(dirname(path), { recursive: true });
  const mode = await stat(path).then(
    (s) => s.mode & 0o777,
    () => undefined,
  );
  const temp = `${path}.agentcontrol-${randomUUID().slice(0, 8)}.tmp`;
  await writeFile(temp, data, mode === undefined ? {} : { mode });
  await rename(temp, path);
}
