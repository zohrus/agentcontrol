// Starts a compiled app the way an installed one runs: from a clean copy of its release folder,
// in a temp working folder, with no `bun` on PATH and no source tree to find.
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const mockAgentMain = join(import.meta.dir, "../../e2e/support/mock-agent/main.ts");
const STARTUP_MS = 60_000;
const PATH = "/usr/bin:/bin";

export interface SmokeApp {
  /** Where the clean copy of the release lives. */
  release: string;
  dataDir: string;
  /** The mock agent's script: rewrite it to change what the next agent process does. */
  scriptPath: string;
  baseUrl: string;
  token: string;
  /** Everything the app printed so far. */
  output(): string;
  stop(): Promise<void>;
}

type Child = Bun.Subprocess<"ignore", "pipe", "pipe">;

/** The folders of one run: a copy of the release, a data folder, a home and a mock agent script. */
function prepareFolders(releaseDir: string) {
  const work = mkdtempSync(join(tmpdir(), "ac-smoke-app-"));
  const release = join(work, "release");
  cpSync(resolve(releaseDir), release, { recursive: true, verbatimSymlinks: true });
  const scriptPath = join(work, "mock-agent-script.json");
  return { work, release, scriptPath, dataDir: join(work, "data"), home: join(work, "home") };
}

/** The environment of an installed app: a PATH with git but without bun, and the mock agent. */
function environmentFor(folders: { home: string; scriptPath: string }): Record<string, string> {
  return {
    PATH,
    HOME: folders.home,
    AGENTCONTROL_MODIFY_AGENT: "mock",
    AGENTCONTROL_AGENT_MOCK_CMD: JSON.stringify([process.execPath, mockAgentMain]),
    MOCK_AGENT_SCRIPT: folders.scriptPath,
  };
}

async function waitForListening(options: { child: Child; seen: () => string }): Promise<string> {
  const deadline = Date.now() + STARTUP_MS;
  while (Date.now() < deadline) {
    const url = /listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(options.seen())?.[1];
    if (url !== undefined) return url;
    if (options.child.exitCode !== null) throw new Error(`the app exited: ${options.seen()}`);
    await Bun.sleep(100);
  }
  throw new Error(`the app did not say it was listening in time: ${options.seen()}`);
}

function collect(child: Child): () => string {
  let text = "";
  for (const stream of [child.stdout, child.stderr]) {
    void stream.pipeTo(
      new WritableStream({ write: (chunk) => void (text += new TextDecoder().decode(chunk)) }),
    );
  }
  return () => text;
}

/** Copies the release folder, starts its app on a free port and waits until it listens. */
export async function startCompiledApp(releaseDir: string): Promise<SmokeApp> {
  const folders = prepareFolders(releaseDir);
  const { work, release, dataDir } = folders;
  await Bun.write(folders.scriptPath, JSON.stringify({ turns: [[]] }));
  if (Bun.which("bun", { PATH }) !== null) {
    throw new Error(
      "bun is on the smoke test's PATH, so it would not prove the app runs without it",
    );
  }
  const args = [join(release, "agentcontrol"), "--port", "0", "--data-dir", dataDir];
  const child = Bun.spawn(args, {
    cwd: work,
    env: environmentFor(folders),
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = collect(child);
  const baseUrl = await waitForListening({ child, seen: output });
  const token = (await Bun.file(join(dataDir, "api-token")).text()).trim();
  const stop = async () => {
    child.kill("SIGTERM");
    await child.exited;
    const relay = join(release, "agentcontrol-relay");
    Bun.spawnSync([relay, "stop", "--data-dir", join(dataDir, "relay")]);
    rmSync(work, { recursive: true, force: true });
  };
  return { release, dataDir, scriptPath: folders.scriptPath, baseUrl, token, output, stop };
}
