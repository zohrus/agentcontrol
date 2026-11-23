import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { onTestEnd } from "./cleanup.ts";

/** A fresh data folder, or a link to one, removed when the test ends. */
export async function aDataFolder(behindALink: boolean): Promise<string> {
  const real = await mkdtemp(join(tmpdir(), "agentcontrol-app-"));
  onTestEnd(() => rm(real, { recursive: true, force: true }));
  if (!behindALink) return real;
  const link = `${real}-link`;
  await symlink(real, link, "dir");
  onTestEnd(() => rm(link, { force: true }));
  return link;
}
