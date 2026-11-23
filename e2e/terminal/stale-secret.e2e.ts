import { afterEach, test } from "bun:test";
import {
  expectThePageToHaveBeenToldToReload,
  expectTheTerminalToSayItCouldNotConnect,
  expectTheTerminalToSayTheSecretIsOutOfDate,
} from "../support/expect/terminal-stale-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { openShellWithAnOutOfDateSecret } from "../support/setup/stale-terminal.ts";
import { startAppWithASession } from "../support/setup/start-app-with-shell.ts";
import { openShell } from "../support/setup/terminal-user.ts";

afterEach(cleanUpAfterTest);

test("a page with an out-of-date secret is told so, and reloads like for any other request", async () => {
  // ********************************************************************
  // ** GIVEN a session of the running app
  // ********************************************************************
  const { app, session } = await startAppWithASession();

  // ********************************************************************
  // ** WHEN a page that was loaded before the app restarted opens the terminal
  // ********************************************************************
  const { shell, refusals } = openShellWithAnOutOfDateSecret(app, { session });

  // ********************************************************************
  // ** THEN the terminal says the secret is out of date and the page is told to reload
  // ********************************************************************
  await expectTheTerminalToSayTheSecretIsOutOfDate(shell);
  await expectThePageToHaveBeenToldToReload(refusals);
});

test("a terminal that is refused for another reason still says it could not connect", async () => {
  // ********************************************************************
  // ** GIVEN a session that was archived
  // ********************************************************************
  const { app, session } = await startAppWithASession();
  await app.user.archivesSession(session, { force: true });

  // ********************************************************************
  // ** WHEN the user opens its terminal with the right secret
  // ********************************************************************
  const shell = openShell(app, { session });

  // ********************************************************************
  // ** THEN the terminal says it could not connect
  // ********************************************************************
  await expectTheTerminalToSayItCouldNotConnect(shell);
});
