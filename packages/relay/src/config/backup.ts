import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isMissing, writeAtomic } from "./fs.ts";
import { StalePlanError } from "./plan.ts";

interface BackupMeta {
  files: { path: string; blob: string | null }[];
  /** What each file held right after the apply (a hash; null for none), to see later changes. */
  after?: { path: string; hash: string | null }[];
}

const hashOf = (bytes: Buffer | undefined): string | null =>
  bytes ? createHash("sha256").update(bytes).digest("hex") : null;

async function readMeta(dir: string, backupId: string): Promise<BackupMeta> {
  const text = await readFile(join(dir, "meta.json"), "utf8").catch(() => undefined);
  if (text === undefined) throw new StalePlanError(`there is no backup "${backupId}"`);
  return JSON.parse(text) as BackupMeta;
}

/** Notes what the files hold now, right after the apply, so a rollback can tell later changes. */
export async function recordApplied(input: { homeDir: string; backupId: string }): Promise<void> {
  const dir = backupDir(input.homeDir, input.backupId);
  const meta = await readMeta(dir, input.backupId);
  const after = await Promise.all(
    meta.files.map(async ({ path }) => ({ path, hash: hashOf(await readBytes(path)) })),
  );
  await writeFile(join(dir, "meta.json"), JSON.stringify({ ...meta, after }, null, 2));
}

/** The files that no longer hold what the apply left in them. */
async function changedSince(meta: BackupMeta): Promise<string[]> {
  const changed = await Promise.all(
    (meta.after ?? []).map(async ({ path, hash }) =>
      hashOf(await readBytes(path)) === hash ? undefined : path,
    ),
  );
  return changed.filter((path) => path !== undefined);
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
  /** Overwrite files that changed after the apply; without it they are listed and nothing is restored. */
  force: boolean;
}): Promise<{ restored: string[]; changedSince: string[] }> {
  const dir = backupDir(input.homeDir, input.backupId);
  const meta = await readMeta(dir, input.backupId);
  const changed = input.force ? [] : await changedSince(meta);
  if (changed.length > 0) return { restored: [], changedSince: changed };
  for (const { path, blob } of meta.files) {
    if (blob === null) await rm(path, { force: true });
    else await writeAtomic(path, await readFile(join(dir, blob)));
  }
  return { restored: meta.files.map((f) => f.path), changedSince: [] };
}
