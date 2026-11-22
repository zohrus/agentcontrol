import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isMissing, writeAtomic } from "./fs.ts";

interface BackupMeta {
  files: { path: string; blob: string | null }[];
}

const backupDir = (homeDir: string, backupId: string): string =>
  join(homeDir, ".agentcontrol", "backups", backupId);

async function readBytes(path: string): Promise<Buffer | undefined> {
  return readFile(path).catch((error: unknown) => {
    if (isMissing(error)) return undefined;
    throw error;
  });
}

/** Copy every file about to change (or note that it did not exist) so it can be restored exactly. */
export async function createBackup(input: { homeDir: string; paths: string[] }): Promise<string> {
  const backupId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 6)}`;
  const dir = backupDir(input.homeDir, backupId);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const meta: BackupMeta = { files: [] };
  for (const [i, path] of input.paths.entries()) {
    const bytes = await readBytes(path);
    if (bytes) await writeFile(join(dir, `${String(i)}.bak`), bytes, { mode: 0o600 });
    meta.files.push({ path, blob: bytes ? `${String(i)}.bak` : null });
  }
  await writeFile(join(dir, "meta.json"), JSON.stringify(meta, null, 2));
  return backupId;
}

/** Put every backed-up file back byte for byte and delete the ones that did not exist before. */
export async function rollbackConfig(input: {
  backupId: string;
  homeDir: string;
}): Promise<string[]> {
  const dir = backupDir(input.homeDir, input.backupId);
  const meta = JSON.parse(await readFile(join(dir, "meta.json"), "utf8")) as BackupMeta;
  for (const { path, blob } of meta.files) {
    if (blob === null) await rm(path, { force: true });
    else await writeAtomic(path, await readFile(join(dir, blob)));
  }
  return meta.files.map((f) => f.path);
}
