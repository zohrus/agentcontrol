import { afterEach, test } from "bun:test";
import {
  expectProcessToBeGone,
  expectShellToHaveEndedWith,
  expectShellToHavePrinted,
  pidOf,
  worktreeOf,
} from "../support/expect/terminal-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithASession } from "../support/setup/start-app-with-shell.ts";
import { openShell } from "../support/setup/terminal-user.ts";

afterEach(cleanUpAfterTest);

test("a command typed in the terminal runs and its output is shown", async () => {
  // ********************************************************************
  // ** GIVEN a session with its terminal open
  // ********************************************************************
  const { app, session } = await startAppWithASession();
  const shell = openShell(app, { session });

  // ********************************************************************
  // ** WHEN the user types `echo hello`
  // ********************************************************************
  shell.types("echo hello");

  // ********************************************************************
  // ** THEN the terminal prints hello
  // ********************************************************************
  await expectShellToHavePrinted(shell, "hello");
  shell.closes();
});

test("the terminal starts in the session's worktree", async () => {
  // ********************************************************************
  // ** GIVEN a session with its terminal open
  // ********************************************************************
  const { app, session } = await startAppWithASession();
  const shell = openShell(app, { session });

  // ********************************************************************
  // ** WHEN the user asks where it is
  // ********************************************************************
  shell.types("echo here=$(pwd -P)");

  // ********************************************************************
  // ** THEN the terminal is in the session's worktree
  // ********************************************************************
  const worktree = await worktreeOf(app, session);
  await expectShellToHavePrinted(shell, `here=${worktree}`);
  shell.closes();
});

test("the terminal has the session's port and none of the relay's own variables", async () => {
  // ********************************************************************
  // ** GIVEN a session with its terminal open, on a relay that runs with variables of its own
  // ********************************************************************
  const { app, session } = await startAppWithASession();
  const shell = openShell(app, { session });

  // ********************************************************************
  // ** WHEN the user prints PORT and the relay's variables
  // ********************************************************************
  shell.types(
    'echo "env port=$PORT bun=${BUN_BE_BUN-unset} cache=${AGENTCONTROL_ADAPTER_CACHE-unset}"',
  );

  // ********************************************************************
  // ** THEN the session's port is set and the relay's variables are not
  // ********************************************************************
  await expectShellToHavePrinted(shell, "env port=\\d+ bun=unset cache=unset");
  shell.closes();
});

test("resizing the terminal changes the size the shell sees", async () => {
  // ********************************************************************
  // ** GIVEN a session with its terminal open at 80 by 24
  // ********************************************************************
  const { app, session } = await startAppWithASession();
  const shell = openShell(app, { session });
  shell.types("stty size");
  await expectShellToHavePrinted(shell, "24 80");

  // ********************************************************************
  // ** WHEN the user makes the terminal 100 wide and 30 tall
  // ********************************************************************
  shell.resizesTo({ cols: 100, rows: 30 });
  shell.types("stty size");

  // ********************************************************************
  // ** THEN the shell sees 30 rows and 100 columns
  // ********************************************************************
  await expectShellToHavePrinted(shell, "30 100");
  shell.closes();
});

test("exiting the shell reports its exit code", async () => {
  // ********************************************************************
  // ** GIVEN a session with its terminal open
  // ********************************************************************
  const { app, session } = await startAppWithASession();
  const shell = openShell(app, { session });

  // ********************************************************************
  // ** WHEN the user types `exit 3`
  // ********************************************************************
  shell.types("exit 3");

  // ********************************************************************
  // ** THEN the terminal reports that the shell ended with code 3
  // ********************************************************************
  await expectShellToHaveEndedWith(shell, 3);
});

test("closing the terminal ends its shell", async () => {
  // ********************************************************************
  // ** GIVEN a session whose terminal shell has reported its process id
  // ********************************************************************
  const { app, session } = await startAppWithASession();
  const shell = openShell(app, { session });
  shell.types("echo pid=$$");
  const pid = await pidOf(shell);

  // ********************************************************************
  // ** WHEN the user closes the terminal
  // ********************************************************************
  shell.closes();

  // ********************************************************************
  // ** THEN no shell process is left
  // ********************************************************************
  await expectProcessToBeGone(pid, "the terminal's shell");
});
