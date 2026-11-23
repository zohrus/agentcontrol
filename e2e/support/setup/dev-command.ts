import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterTimeout, readListeningUrl } from "./app-process.ts";
import { onTestEnd } from "./cleanup.ts";

const devScript = join(import.meta.dir, "../../../scripts/dev.ts");
const relayMain = join(import.meta.dir, "../../../packages/relay/src/main.ts");
const recorder = join(import.meta.dir, "record-opened-url.ts");

/** `bun dev`, running with a browser that is only a file which records what it was asked to open. */
export interface DevCommand {
  /** Where the app said it listens. */
  readonly appUrl: string;
  /** The file the pretend browser writes the address to; it does not exist until one is opened. */
  readonly openedFile: string;
}

/** Runs `bun dev` with its own data folder; `AGENTCONTROL_NO_OPEN` is set only when asked for. */
export async function startDevCommand(options: { noOpen: boolean }): Promise<DevCommand> {
  const folder = await mkdtemp(join(tmpdir(), "agentcontrol-dev-"));
  const openedFile = join(folder, "opened-url.txt");
  const env = {
    ...Bun.env,
    AGENTCONTROL_OPEN_COMMAND: JSON.stringify(["bun", recorder, openedFile]),
    ...(options.noOpen ? { AGENTCONTROL_NO_OPEN: "1" } : {}),
  };
  const dataDir = join(folder, "data");
  const child = Bun.spawn(["bun", devScript, "--port", "0", "--data-dir", dataDir], {
    stdout: "pipe",
    stderr: "inherit",
    env,
  });
  onTestEnd(async () => {
    child.kill("SIGTERM");
    await child.exited;
    await Bun.spawn(["bun", relayMain, "stop", "--data-dir", join(dataDir, "relay")]).exited;
    await rm(folder, { recursive: true, force: true });
  });
  const appUrl = await Promise.race([readListeningUrl(child.stdout), afterTimeout()]);
  return { appUrl, openedFile };
}
