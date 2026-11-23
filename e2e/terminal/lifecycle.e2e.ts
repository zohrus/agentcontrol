import { afterEach, test } from "bun:test";
import {
  expectProcessToBeGone,
  expectShellToHaveEndedWith,
  expectShellToHavePrinted,
  pidOf,
} from "../support/expect/terminal-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithASession } from "../support/setup/start-app-with-shell.ts";
import { openShell } from "../support/setup/terminal-user.ts";

afterEach(cleanUpAfterTest);

test("archiving the session ends its terminal", async () => {
  // ********************************************************************
  // ** GIVEN a session whose terminal is open
  // ********************************************************************
  const { app, session } = await startAppWithASession();
  const shell = openShell(app, { session });
  shell.types("echo pid=$$");
  const pid = await pidOf(shell);

  // ********************************************************************
  // ** WHEN the user archives the session
  // ********************************************************************
  await app.user.archivesSession(session, { force: true });

  // ********************************************************************
  // ** THEN the terminal reports that its shell ended
  // ********************************************************************
  await expectShellToHaveEndedWith(shell, null);
  // AND no shell process is left
  await expectProcessToBeGone(pid, "the terminal's shell");
});

test("stopping the relay ends every terminal and leaves no shell behind", async () => {
  // ********************************************************************
  // ** GIVEN a session whose terminal is open
  // ********************************************************************
  const { app, session } = await startAppWithASession();
  const shell = openShell(app, { session });
  shell.types("echo pid=$$");
  const pid = await pidOf(shell);

  // ********************************************************************
  // ** WHEN the relay stops
  // ********************************************************************
  await app.theRelayStops();

  // ********************************************************************
  // ** THEN the terminal reports that its shell ended
  // ********************************************************************
  await expectShellToHaveEndedWith(shell, null);
  // AND no shell process is left
  await expectProcessToBeGone(pid, "the terminal's shell");
});

test("a terminal opened after the first one ended starts a fresh shell", async () => {
  // ********************************************************************
  // ** GIVEN a session whose first terminal ended with `exit`
  // ********************************************************************
  const { app, session } = await startAppWithASession();
  const first = openShell(app, { session });
  first.types("exit 0");
  await expectShellToHaveEndedWith(first, 0);

  // ********************************************************************
  // ** WHEN the user opens a new terminal
  // ********************************************************************
  const second = openShell(app, { session });
  second.types("echo again");

  // ********************************************************************
  // ** THEN the new terminal works
  // ********************************************************************
  await expectShellToHavePrinted(second, "again");
  second.closes();
});
