import { afterEach, test } from "bun:test";
import {
  expectShellToHaveEndedWith,
  expectShellToHavePrinted,
} from "../support/expect/terminal-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { openShellOnAnAppThatSendsAFrameThatIsNotJson } from "../support/setup/odd-terminal-server.ts";
import { startAppWithASession } from "../support/setup/start-app-with-shell.ts";

afterEach(cleanUpAfterTest);

test("a terminal ignores a frame that is not JSON and goes on with the ones after it", async () => {
  // ********************************************************************
  // ** GIVEN a terminal whose app sends a line that is not JSON before its output
  // ********************************************************************
  const { app, session } = await startAppWithASession();

  // ********************************************************************
  // ** WHEN the user opens the terminal
  // ********************************************************************
  const shell = openShellOnAnAppThatSendsAFrameThatIsNotJson(app, { session });
  shell.types("anything");

  // ********************************************************************
  // ** THEN the output that follows is shown and the shell ends normally
  // ********************************************************************
  await expectShellToHavePrinted(shell, "hello");
  await expectShellToHaveEndedWith(shell, 0);
});
