import { chmod, mkdir } from "node:fs/promises";
import { join } from "node:path";

const mockAgentMain = join(import.meta.dir, "../mock-agent/main.ts");

/** What can be different about the host a test starts. */
export interface SshHostOptions {
  /** The app has no relay binary to install for this host. */
  relayBinaryMissing?: boolean;
  /** Claude Code is only found when the PATH of the user's login shell is used, as on a real host. */
  agentOnLoginPathOnly?: boolean;
  /** Install this binary (a compiled relay) instead of the script that runs the checkout's relay. */
  relayBinary?: string;
}

async function writeExecutable(path: string, lines: string[]): Promise<void> {
  await Bun.write(path, `${lines.join("\n")}\n`);
  await chmod(path, 0o755);
}

/**
 * A login shell whose profile puts a folder with `fake-claude` on PATH, like an npm or nvm setup
 * would. sshd's own sessions do not have that folder on their PATH. Returns the shell, and the
 * command name the host's relay is told to start Claude Code with.
 */
export async function writeLoginShellWithAgent(
  folder: string,
): Promise<{ shell: string; claudeCommand: string[] }> {
  const bin = join(folder, "login-bin");
  await mkdir(bin, { recursive: true });
  await writeExecutable(join(bin, "fake-claude"), [
    "#!/bin/sh",
    `exec '${process.execPath}' '${mockAgentMain}' "$@"`,
  ]);
  const shell = join(folder, "login-shell");
  await writeExecutable(shell, [
    "#!/bin/sh",
    `if [ "$1" = "-lc" ]; then PATH='${bin}':"$PATH" exec /bin/sh -c "$2"; fi`,
    'exec /bin/sh "$@"',
  ]);
  return { shell, claudeCommand: ["fake-claude"] };
}
