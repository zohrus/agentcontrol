import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The relay's own binary only acts as `bun` while `BUN_BE_BUN` is set, and the variable has to be
 * there when the process starts. So an adapter is started through a small shell script, `runtime`,
 * that sets the variable for that one `exec` and runs `launch.js`, which removes it first thing:
 * the adapter, and everything it runs, never see it.
 *
 * Some adapters start a JavaScript file of their own with `process.execPath` (Codex does, for its
 * `codex.js`), expecting a runtime there. `launch.js` points `process.execPath` at `runtime`, so
 * such a child goes through the same script and is cleaned the same way. Bun's own `Bun.spawn`
 * starts from the variables the process began with, so it is told to use the cleaned ones;
 * `node:child_process` already does.
 */
const LAUNCHER_SOURCE = `delete process.env.BUN_BE_BUN;
const runtime = import.meta.dir + "/runtime";
Object.defineProperty(process, "execPath", { value: runtime, configurable: true, writable: true });
for (const name of ["spawn", "spawnSync"]) {
  const original = Bun[name].bind(Bun);
  Bun[name] = (first, second) =>
    Array.isArray(first)
      ? original(first, { ...second, env: second?.env ?? process.env })
      : original({ ...first, env: first.env ?? process.env });
}
process.argv.splice(1, 1);
await import(process.argv[1]);
`;

const quoted = (text: string): string => `'${text.replaceAll("'", "'\\''")}'`;

/**
 * Bun reads `bunfig.toml` and `.env` files from the folder it starts in, which is the session's
 * worktree: a repo could preload code into the adapter or add variables to it. An empty config
 * file in the adapters folder and `--no-env-file` keep the repo's files out.
 */
function runtimeSource(options: { launcher: string; config: string }): string {
  const flags = `--no-env-file --config=${quoted(options.config)}`;
  return `#!/bin/sh\nBUN_BE_BUN=1 exec ${quoted(process.execPath)} ${flags} run ${quoted(options.launcher)} "$@"\n`;
}

/** Writes the file unless it already holds this text; a rename keeps a reader from seeing half. */
async function writeWhole(file: { path: string; text: string; mode: number }): Promise<void> {
  const current = await readFile(file.path, "utf8").catch(() => undefined);
  if (current === file.text) return;
  const temporary = `${file.path}.${randomUUID()}`;
  await writeFile(temporary, file.text, { mode: file.mode });
  await rename(temporary, file.path);
}

/**
 * The argv that starts the adapter's entry file: the `runtime` script in the adapters folder, which
 * runs this program as `bun run launch.js <entry>`. Neither the returned environment nor the
 * adapter's own holds `BUN_BE_BUN`.
 */
export async function launchAdapter(options: {
  entry: string;
  folder: string;
}): Promise<{ command: string[]; env: Record<string, string> }> {
  const { entry, folder } = options;
  const launcher = join(folder, "launch.js");
  const runtime = join(folder, "runtime");
  await mkdir(folder, { recursive: true });
  await writeWhole({ path: launcher, text: LAUNCHER_SOURCE, mode: 0o644 });
  const config = join(folder, "bunfig.toml");
  await writeWhole({ path: config, text: "", mode: 0o644 });
  await writeWhole({ path: runtime, text: runtimeSource({ launcher, config }), mode: 0o755 });
  return { command: [runtime, entry], env: {} };
}
