import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createClient, type Client } from "@agentcontrol/sdk";
import { launchApp } from "../../../support/setup/app-process.ts";
import { onTestEnd } from "../../../support/setup/cleanup.ts";
import { createLocalRepo } from "../../../support/setup/local-repo.ts";
import { stopRelayDaemon } from "../../../support/setup/relay-client.ts";
import { configUserOf, type ConfigUser } from "./config-user.ts";

/** The files of a folder, by path relative to it; a file that does not exist reads as undefined. */
export interface Folder {
  readonly path: string;
  has(relativePath: string, content: string): Promise<void>;
  read(relativePath: string): Promise<string | undefined>;
  /** Edits a file by hand, the way a user would in an editor. */
  edits(relativePath: string, change: { replace: string; with: string }): Promise<void>;
  /** Every file below the folder with its content, except Agent Control's own backups. */
  snapshot(): Promise<Record<string, string>>;
}

/** The app running against a fake home folder, so no test ever touches the real agent config. */
export interface ConfigApp {
  readonly sdk: Client;
  readonly home: Folder;
  readonly repo: Folder;
  readonly user: ConfigUser;
}

async function filesBelow(root: string, dir = ""): Promise<string[]> {
  const entries = await readdir(join(root, dir), { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const relative = join(dir, entry.name);
      return entry.isDirectory() ? filesBelow(root, relative) : [relative];
    }),
  );
  return nested.flat();
}

function folderAt(path: string, skip: string[] = []): Folder {
  return {
    path,
    has: async (relativePath, content) => {
      await mkdir(dirname(join(path, relativePath)), { recursive: true });
      await writeFile(join(path, relativePath), content);
    },
    edits: async (relativePath, change) => {
      const before = await readFile(join(path, relativePath), "utf8");
      await writeFile(join(path, relativePath), before.replace(change.replace, change.with));
    },
    read: (relativePath) => readFile(join(path, relativePath), "utf8").catch(() => undefined),
    snapshot: async () => {
      const files = (await filesBelow(path)).filter((f) => !skip.some((s) => f.startsWith(s)));
      const contents = await Promise.all(files.map((f) => readFile(join(path, f), "utf8")));
      return Object.fromEntries(files.map((file, i) => [file, contents[i] ?? ""]));
    },
  };
}

async function temporaryFolder(prefix: string): Promise<string> {
  const path = await realpath(await mkdtemp(join(tmpdir(), prefix)));
  onTestEnd(() => rm(path, { recursive: true, force: true }));
  return path;
}

/** Starts the app and its relay with an empty fake home folder and an empty git repo. */
export async function startAppWithEmptyHome(): Promise<ConfigApp> {
  const dataDir = await temporaryFolder("agentcontrol-app-");
  const homePath = await temporaryFolder("agentcontrol-home-");
  const repoPath = await createLocalRepo();
  onTestEnd(() => stopRelayDaemon(join(dataDir, "relay")));
  const app = await launchApp({ dataDir, env: { AGENTCONTROL_CONFIG_HOME: homePath } });
  onTestEnd(() => app.stop());
  const sdk = createClient({ baseUrl: app.baseUrl });
  const home = folderAt(homePath, [join(".agentcontrol", "backups")]);
  return { sdk, home, repo: folderAt(repoPath), user: configUserOf({ sdk, repoPath }) };
}
