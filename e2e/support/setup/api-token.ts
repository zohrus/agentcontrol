import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

/** The secret the app wrote to `<dataDir>/api-token`, which is how a local program gets it. */
export async function readApiToken(dataDir: string): Promise<string> {
  return (await readFile(join(dataDir, "api-token"), "utf8")).trim();
}

/** The permission bits of the token file, e.g. 0o600. */
export async function apiTokenFileMode(dataDir: string): Promise<number> {
  return (await stat(join(dataDir, "api-token"))).mode & 0o777;
}
