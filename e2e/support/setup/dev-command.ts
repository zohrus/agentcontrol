import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { onTestEnd } from "./cleanup.ts";
import { eventually } from "./eventually.ts";

const devScript = join(import.meta.dir, "../../../scripts/dev.ts");
const relayMain = join(import.meta.dir, "../../../packages/relay/src/main.ts");
const recorder = join(import.meta.dir, "record-opened-url.ts");
const LISTENING = /listening on (http:\/\/127\.0\.0\.1:\d+)/;
const START_TIMEOUT_MS = 30_000;

/** `bun dev`, running with a browser that is only a file which records what it was asked to open. */
export interface DevCommand {
  /** Where the app said it listens. */
  readonly appUrl: string;
  /** The file the pretend browser writes the address to; it does not exist until one is opened. */
  readonly openedFile: string;
  /** Everything `bun dev` has printed so far. */
  output(): string;
}

/** Collects what the process prints, so that a test can read it at any time. */
function collect(stream: ReadableStream<Uint8Array>): () => string {
  let text = "";
  const decoder = new TextDecoder();
  void stream.pipeTo(
    new WritableStream({
      write: (chunk) => {
        text += decoder.decode(chunk, { stream: true });
      },
    }),
  );
  return () => text;
}

/** Runs `bun dev` with its own data folder; `AGENTCONTROL_NO_OPEN` is set only when asked for. */
async function startDevCommand(options: { noOpen: boolean }): Promise<DevCommand> {
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
  const output = collect(child.stdout);
  await eventually(
    "expected `bun dev` to say where the app listens",
    () => Promise.resolve(LISTENING.test(output()) ? undefined : `it printed: ${output()}`),
    START_TIMEOUT_MS,
  );
  return { appUrl: LISTENING.exec(output())?.[1] ?? "", openedFile, output };
}

/** A developer at a terminal; with `noOpen` they have set AGENTCONTROL_NO_OPEN. */
export function aDeveloper(options: { noOpen: boolean }) {
  return { runsBunDev: () => startDevCommand(options) };
}
