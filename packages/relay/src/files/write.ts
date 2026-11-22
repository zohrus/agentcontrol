import { hashContent } from "./hash.ts";
import { resolveInside } from "./safe-path.ts";

/** Writes the file unless it changed since the caller read it (a missing file hashes as empty). */
export async function writeFileIfUnchanged(options: {
  worktreePath: string;
  path: string;
  content: string;
  expectedHash: string;
}): Promise<{ hash: string } | { stale: true; currentHash: string }> {
  const target = await resolveInside(options.worktreePath, options.path);
  const file = Bun.file(target);
  const current = (await file.exists()) ? await file.text() : "";
  const currentHash = hashContent(current);
  if (currentHash !== options.expectedHash) return { stale: true, currentHash };
  await Bun.write(target, options.content);
  return { hash: hashContent(options.content) };
}
