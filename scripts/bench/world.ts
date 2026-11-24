import { join } from "node:path";
import { givesTheRepoARemote } from "../../e2e/support/setup/repo-remote.ts";
import { type RunningApp, startAppWithLocalWorkspace } from "../../e2e/support/setup/start-app.ts";
import { givesTheRemoteLatency } from "./slow-remote.ts";

/** Makes a big ignored folder, as `npm install` makes `node_modules`. */
const MAKE_MODULES = `const { mkdirSync, writeFileSync } = require("node:fs");
const files = Number(process.argv[2]);
for (let i = 0; i < files; i++) {
  const dir = "node_modules/pkg-" + String(i % 2000);
  if (i < 2000) mkdirSync(dir, { recursive: true });
  writeFileSync(dir + "/file-" + String(i) + ".js", "module.exports = " + String(i) + ";\\n");
}
`;

export interface BenchSizes {
  /** Tracked files in the repository. */
  repoFiles: number;
  /** Small files the setup script creates in an ignored folder. */
  moduleFiles: number;
  /** Milliseconds every git command that talks to the remote waits first; 0 for none. */
  remoteLatencyMs: number;
}

export interface BigWorld {
  app: RunningApp;
  /** The command that makes the ignored folder, as the setup script runs it. */
  makeModules: string[];
}

/** The app with a big repository, a local bare remote, the mock agent and a setup script that makes a big ignored folder. */
export async function startBigWorld(sizes: BenchSizes): Promise<BigWorld> {
  const app = await startAppWithLocalWorkspace();
  await theRepoHasManyFiles(app.repoPath, sizes.repoFiles);
  const remote = await givesTheRepoARemote(app.repoPath);
  // A real repository is packed: without this git packs it in the background while a session starts.
  for (const cwd of [app.repoPath, remote]) await Bun.spawn(["git", "gc", "-q"], { cwd }).exited;
  const makeModules = await theSetupScriptFillsNodeModules(app, sizes.moduleFiles);
  const { remoteLatencyMs: latencyMs } = sizes;
  if (latencyMs > 0) await givesTheRemoteLatency({ repoPath: app.repoPath, remote, latencyMs });
  return { app, makeModules };
}

/** The repo tracks `count` small source files in 400 folders, as a real project does, and ignores node_modules. */
async function theRepoHasManyFiles(repoPath: string, count: number): Promise<void> {
  const writes = Array.from({ length: count }, (_, i) =>
    Bun.write(
      join(repoPath, "src", `d${String(i % 400)}`, `f${String(i)}.ts`),
      `export const x = ${String(i)};\n`,
    ),
  );
  await Promise.all(writes);
  await Bun.write(join(repoPath, ".gitignore"), ".env\nnode_modules\n");
  const commit = ["add -A", "commit -qm Many-files"];
  for (const args of commit) await Bun.spawn(["git", ...args.split(" ")], { cwd: repoPath }).exited;
}

/** The repo's setup script makes `files` small files under node_modules; returns the command that does it. */
async function theSetupScriptFillsNodeModules(app: RunningApp, files: number): Promise<string[]> {
  const maker = join(app.dataDir, "make-modules.js");
  await Bun.write(maker, MAKE_MODULES);
  const makeModules = ["bun", maker, String(files)];
  const repo = await app.sdk.repos.add(app.repoPath);
  const setupScript = `echo begin\n${makeModules.join(" ")}\necho end`;
  await app.sdk.repos.setSetup(repo.repoId, { copyFiles: [".env*"], setupScript });
  return makeModules;
}
