import { stat } from "node:fs/promises";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "../../..");

async function output(command: string[]): Promise<string> {
  const run = Bun.spawn(command, { cwd: repoRoot, stdout: "pipe", stderr: "pipe" });
  const [out, exitCode] = await Promise.all([run.stdout.text(), run.exited]);
  if (exitCode !== 0) throw new Error(`${command.join(" ")} failed in ${repoRoot}`);
  return out;
}

/** The permission bits of every tracked file, by path (git may be told to ignore them; this is not). */
export async function readsTheModesOfTheTrackedFiles(): Promise<Record<string, string>> {
  const paths = (await output(["git", "ls-files", "-z"])).split("\0").filter((path) => path !== "");
  const modes: Record<string, string> = {};
  await Promise.all(
    paths.map(async (path) => {
      modes[path] = ((await stat(join(repoRoot, path))).mode & 0o777).toString(8);
    }),
  );
  return modes;
}

/** Installs the dependencies as a person does after pulling: the lockfile must already be right. */
export async function installsTheDependencies(): Promise<void> {
  await output(["bun", "install", "--frozen-lockfile"]);
}
