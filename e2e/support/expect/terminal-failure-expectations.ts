import type { OpenShell } from "../setup/terminal-user.ts";

/** The terminal says in plain words that no shell could start, and ends without an exit code. */
export async function expectTheTerminalToSayNoShellCouldStart(shell: OpenShell): Promise<void> {
  await shell.problems.waitFor(
    (problem) => /could not start a shell/i.test(problem),
    "expected the terminal to say that no shell could start",
  );
  await shell.endings.waitFor(
    (ending) => ending.exitCode === null,
    "expected the terminal to end without an exit code",
  );
}
