import { rm } from "node:fs/promises";
import { afterEach, test } from "bun:test";
import { worktreeOf } from "../support/expect/terminal-expectations.ts";
import { expectTheTerminalToSayNoShellCouldStart } from "../support/expect/terminal-failure-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithASession } from "../support/setup/start-app-with-shell.ts";
import { openShell } from "../support/setup/terminal-user.ts";

afterEach(cleanUpAfterTest);

test("a terminal that cannot start its shell says so in words and ends", async () => {
  // ********************************************************************
  // ** GIVEN a session whose worktree folder was deleted behind its back
  // ********************************************************************
  const { app, session } = await startAppWithASession();
  await rm(await worktreeOf(app, session), { recursive: true, force: true });

  // ********************************************************************
  // ** WHEN the user opens its terminal
  // ********************************************************************
  const shell = openShell(app, { session });

  // ********************************************************************
  // ** THEN the terminal says that no shell could start, and ends
  // ********************************************************************
  await expectTheTerminalToSayNoShellCouldStart(shell);
});
