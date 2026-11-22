import type { DriftReport } from "@agentcontrol/protocol";
import { editors } from "./editors.ts";
import { makeCtx, sha256 } from "./fs.ts";
import { loadManifest } from "./manifest.ts";
import type { ConfigCtx, Format, ManifestFile } from "./types.ts";

type Status = DriftReport["entries"][number]["status"];

/** What each owned entry holds now; undefined when the file can no longer be read as its format. */
function readEntries(
  editor: (typeof editors)[Format],
  content: string,
  file: ManifestFile,
): (string | undefined)[] | undefined {
  try {
    return file.entries.map((e) => editor.get(content, e.key));
  } catch {
    return undefined;
  }
}

async function fileStatus(ctx: ConfigCtx, path: string, file: ManifestFile): Promise<Status> {
  const content = await ctx.readFile(path);
  if (content === undefined) return "missing";
  const editor = editors[file.format];
  const seen = readEntries(editor, content, file);
  if (seen === undefined) return "drift";
  if (seen.every((v) => v === undefined)) return "missing";
  const same = file.entries.every(
    (e, i) => seen[i] !== undefined && sha256(seen[i] ?? "") === e.hash,
  );
  return same ? "in-sync" : "drift";
}

/** Compare each managed entry on disk with the hash recorded when this app last wrote it. */
export async function detectDrift(input: { homeDir: string }): Promise<DriftReport> {
  const ctx = makeCtx(input);
  const manifest = await loadManifest(ctx);
  const entries = await Promise.all(
    Object.entries(manifest.files).map(async ([path, file]) => ({
      path,
      itemIds: [...new Set(file.entries.map((e) => e.itemId))],
      status: await fileStatus(ctx, path, file),
    })),
  );
  return { entries };
}
