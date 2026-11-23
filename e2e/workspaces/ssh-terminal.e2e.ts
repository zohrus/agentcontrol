import { afterEach, setDefaultTimeout, test } from "bun:test";
import { expectShellToHavePrinted, worktreeOf } from "../support/expect/terminal-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithSshHost } from "../support/setup/start-app-with-ssh-host.ts";
import { openShell } from "../support/setup/terminal-user.ts";

// Every ssh call is a real handshake, and the suite runs files side by side.
setDefaultTimeout(60_000);
afterEach(cleanUpAfterTest);

test("the terminal of a session on an ssh host is a shell on that host, in the session's worktree", async () => {
  // ********************************************************************
  // ** GIVEN a session on an ssh workspace
  // ********************************************************************
  const { app, host, user } = await startAppWithSshHost();
  const workspace = await user.addsTheHost();
  host.mockAgent.willReply("Done");
  const session = await user.startsSessionOn(workspace, { prompt: "Work on the host" });

  // ********************************************************************
  // ** WHEN the user opens its terminal and asks for the home folder and where it is
  // ********************************************************************
  const shell = openShell(app, { session });
  shell.types("echo here=$HOME:$(pwd -P)");

  // ********************************************************************
  // ** THEN the shell runs on the host: its home, in the session's worktree there
  // ********************************************************************
  const worktree = await worktreeOf(app, session);
  await expectShellToHavePrinted(shell, `here=${host.home}:${worktree}`);
  shell.closes();
});
