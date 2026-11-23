import { realpath } from "node:fs/promises";
import type { AppAccess, Session } from "../setup/app.ts";
import { eventually } from "../setup/eventually.ts";
import type { OpenShell } from "../setup/terminal-user.ts";

/** The end of what the shell printed, for a failure message: escapes made visible. */
function screenTail(shell: OpenShell): string {
  const tail = shell.printed().slice(-400);
  return tail === "" ? "nothing yet" : JSON.stringify(tail);
}

/** Waits for a screen; when none matches, the failure says what the terminal did print. */
async function expectScreen(
  shell: OpenShell,
  call: { matches: (printed: string) => boolean; expected: string },
): Promise<string> {
  try {
    return await shell.screens.waitFor(call.matches, call.expected);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${reason}. The terminal showed ${screenTail(shell)}`, { cause: error });
  }
}

/** The shell printed a line that is exactly this text (a typed command's echo is not one). */
export function expectShellToHavePrinted(shell: OpenShell, line: string): Promise<string> {
  const pattern = new RegExp(`(^|\\n|\\r|[#$] )${line}\\r?\\n`);
  return expectScreen(shell, {
    matches: (printed) => pattern.test(printed),
    expected: `expected the terminal to print the line "${line}"`,
  });
}

/** The shell is up and waiting for a command: it printed a prompt. */
export async function expectShellToShowAPrompt(shell: OpenShell): Promise<void> {
  await expectScreen(shell, {
    // The prompt is the last thing printed: a banner that happens to hold `$ ` is not one.
    matches: (printed) => /[#$] (?:\x1b\[[\d;?]*[a-zA-Z])*$/.test(printed),
    expected: "expected the terminal to show a prompt",
  });
}

/** The terminal's shell ended with this exit code. */
export async function expectShellToHaveEndedWith(
  shell: OpenShell,
  exitCode: number | null,
): Promise<void> {
  await shell.endings.waitFor(
    (ended) => ended.exitCode === exitCode,
    `expected the shell to end with exit code ${String(exitCode)}`,
  );
}

/** The shell reports a process id on a line `pid=<n>`; the number. */
export async function pidOf(shell: OpenShell): Promise<number> {
  const screen = await expectShellToHavePrinted(shell, "pid=\\d+");
  const found = /(?:^|\n|[#$] )pid=(\d+)\r?\n/.exec(screen);
  return Number(found?.[1]);
}

/** No process has this id any more. */
export async function expectProcessToBeGone(pid: number, who: string): Promise<void> {
  await eventually(`expected ${who} (process ${String(pid)}) to be gone`, () => {
    try {
      process.kill(pid, 0);
      return Promise.resolve("it is still running");
    } catch {
      return Promise.resolve(undefined);
    }
  });
}

/** The folder of the session's worktree, as the live stream first announced it. */
export async function worktreeOf(app: AppAccess, session: Session): Promise<string> {
  const created = await app.streamed.waitFor(
    (event) => event.sessionId === session.id && event.kind === "session-created",
    `expected session "${session.title}" to have been created`,
  );
  if (created.kind !== "session-created") throw new Error("expected a session-created event");
  return realpath(created.payload.worktreePath);
}
