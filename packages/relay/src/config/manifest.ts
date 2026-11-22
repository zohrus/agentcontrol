import { join } from "node:path";
import type { ConfigAgent } from "@agentcontrol/protocol";
import type { ConfigCtx, Manifest, ManifestFile } from "./types.ts";

export const manifestPath = (homeDir: string): string =>
  join(homeDir, ".agentcontrol", "managed.json");

const emptyManifest = (): Manifest => ({ version: 1, files: {} });

export function parseManifest(raw: string | undefined): Manifest {
  if (raw === undefined) return emptyManifest();
  try {
    const parsed = JSON.parse(raw) as Manifest | { version?: unknown };
    return parsed.version === 1 ? (parsed as Manifest) : emptyManifest();
  } catch {
    return emptyManifest();
  }
}

export async function loadManifest(ctx: ConfigCtx): Promise<Manifest> {
  return parseManifest(await ctx.readFile(manifestPath(ctx.homeDir)));
}

export const serializeManifest = (manifest: Manifest): string =>
  `${JSON.stringify(manifest, null, 2)}\n`;

/** Replace every file the given agents own with the freshly rendered ones. */
export function mergeManifest(input: {
  old: Manifest;
  agents: ConfigAgent[];
  managed: Record<string, ManifestFile>;
}): Manifest {
  const kept = Object.entries(input.old.files).filter(([, f]) => !input.agents.includes(f.agent));
  return { version: 1, files: { ...Object.fromEntries(kept), ...input.managed } };
}
