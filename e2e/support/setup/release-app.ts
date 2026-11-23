import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterTimeout, readListeningUrl } from "./app-process.ts";
import { onTestEnd } from "./cleanup.ts";
import { aResourcesFolderWithTools } from "./release-folder.ts";

const appMain = join(import.meta.dir, "../../../packages/app/src/main.ts");
const relayMain = join(import.meta.dir, "../../../packages/relay/src/main.ts");

/** The app started the way an installed release starts: with no flags, only its resources folder. */
export interface ReleaseApp {
  readonly baseUrl: string;
  readonly dataDir: string;
}

async function stopRelay(dataDir: string): Promise<void> {
  const stop = Bun.spawn(["bun", relayMain, "stop", "--data-dir", join(dataDir, "relay")]);
  await stop.exited;
}

/** Starts `main.ts` as a program, with a resources folder and no `--ui-root` or `--ui-dist`. */
export async function startReleaseApp(): Promise<ReleaseApp> {
  const resources = await aResourcesFolderWithTools();
  const dataDir = await mkdtemp(join(tmpdir(), "agentcontrol-release-"));
  const child = Bun.spawn(["bun", appMain, "--port", "0", "--data-dir", dataDir], {
    stdout: "pipe",
    stderr: "inherit",
    env: { ...Bun.env, AGENTCONTROL_RESOURCES: resources.path },
  });
  onTestEnd(async () => {
    child.kill("SIGTERM");
    await child.exited;
    await stopRelay(dataDir);
    await rm(dataDir, { recursive: true, force: true });
  });
  const baseUrl = await Promise.race([readListeningUrl(child.stdout), afterTimeout()]);
  return { baseUrl, dataDir };
}
