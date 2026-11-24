import { realpath } from "node:fs/promises";
import type { AppAccess, Session } from "../setup/app.ts";
import { eventually } from "../setup/eventually.ts";
import type { OpenShell } from "../setup/terminal-user.ts";

/**
 * What a person reads in the terminal: the text without its control sequences. Some login shells
 * wrap every prompt and every command's output in them (Ubuntu's systemd shell integration writes
 * `ESC ] 3008 ; ... ESC \`), so a line can start right after one.
 */
function visibleText(printed: string): string {
  return printed
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[\d;?]*[ -/]*[@-~]/g, "");
}

/** The end of what the terminal showed, for a failure message: line ends made visible. */
function screenTail(shell: OpenShell): string {
  const tail = visibleText(shell.printed()).slice(-400);
  return tail === "" ? "nothing yet" : JSON.stringify(tail);
}

/** Waits for a screen; when none matches, the failure says what the terminal did show. */
async function expectScreen(
  shell: OpenShell,
  call: { matches: (shown: string) => boolean; expected: string },
): Promise<string> {
  try {
    const printed = await shell.screens.waitFor(
      (screen) => call.matches(visibleText(screen)),
      call.expected,
    );
    return visibleText(printed);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${reason}. The terminal showed ${screenTail(shell)}`, { cause: error });
  }
}

/** The shell printed a line that is exactly this text (a typed command's echo is not one). */
export function expectShellToHavePrinted(shell: OpenShell, line: string): Promise<string> {
  const pattern = new RegExp(`(^|\\n|\\r|[#$] )${line}\\r?\\n`);
  return expectScreen(shell, {
    matches: (shown) => pattern.test(shown),
    expected: `expected the terminal to print the line "${line}"`,
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

/** The folder of the session's worktree, once it is made. */
export async function worktreeOf(app: AppAccess, session: Session): Promise<string> {
  await app.streamed.waitFor(
    (event) => event.sessionId === session.id && event.kind === "setup-finished",
    `expected the worktree of session "${session.title}" to be made`,
  );
  const created = await app.streamed.waitFor(
    (event) => event.sessionId === session.id && event.kind === "session-created",
    `expected session "${session.title}" to have been created`,
  );
  if (created.kind !== "session-created") throw new Error("expected a session-created event");
  return realpath(created.payload.worktreePath);
}
