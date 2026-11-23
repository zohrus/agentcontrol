import { afterEach, test } from "bun:test";
import {
  expectBrowserVsCodeAvailable,
  expectBrowserVsCodeUnavailable,
  expectChecklistToShowCodeServer,
  expectOpeningToBeRefused,
} from "../support/expect/ide-availability-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithCodeServer, startAppWithoutCodeServer } from "../support/setup/ide-setups.ts";

afterEach(cleanUpAfterTest);

test("the workspace checklist shows code-server as found, with its version", async () => {
  // ********************************************************************
  // ** GIVEN a workspace where code-server is installed
  // ********************************************************************
  const { app } = await startAppWithCodeServer();

  // ********************************************************************
  // ** WHEN the user reads the workspace checklist
  // ********************************************************************
  const steps = await app.user.readsTheChecklist();

  // ********************************************************************
  // ** THEN code-server is listed as found, with version 4.99.9
  // ********************************************************************
  expectChecklistToShowCodeServer(steps, { status: "ok", detail: "found 4.99.9" });
});

test("the workspace checklist lists a missing code-server as optional, with how to install it", async () => {
  // ********************************************************************
  // ** GIVEN a workspace where code-server is not installed
  // ********************************************************************
  const { app } = await startAppWithoutCodeServer();

  // ********************************************************************
  // ** WHEN the user reads the workspace checklist
  // ********************************************************************
  const steps = await app.user.readsTheChecklist();

  // ********************************************************************
  // ** THEN code-server is listed as skipped (not a failure), with the install command
  // ********************************************************************
  expectChecklistToShowCodeServer(steps, {
    status: "skipped",
    detail:
      "not installed (optional): install it with curl -fsSL https://code-server.dev/install.sh",
  });
});

test("a session on a workspace with code-server can be opened in the browser VS Code", async () => {
  // ********************************************************************
  // ** GIVEN a finished session on a workspace where code-server is installed
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();

  // ********************************************************************
  // ** WHEN the app is asked whether it can be opened
  // ********************************************************************
  // ********************************************************************
  // ** THEN it can
  // ********************************************************************
  await expectBrowserVsCodeAvailable({ app, session });
});

test("without code-server the browser VS Code says it is not installed and cannot be opened", async () => {
  // ********************************************************************
  // ** GIVEN a finished session on a workspace without code-server
  // ********************************************************************
  const { app, session } = await startAppWithoutCodeServer();

  // ********************************************************************
  // ** WHEN the user asks to open it
  // ********************************************************************
  // ********************************************************************
  // ** THEN the app says code-server is not installed there, and refuses to open
  // ********************************************************************
  await expectBrowserVsCodeUnavailable({ app, session }, "code-server is not installed on");
  await expectOpeningToBeRefused({ app, session });
});

test("an archived session cannot be opened in the browser VS Code", async () => {
  // ********************************************************************
  // ** GIVEN a session that was archived
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  await app.user.archivesSession(session, { force: true });

  // ********************************************************************
  // ** WHEN the user asks to open it
  // ********************************************************************
  // ********************************************************************
  // ** THEN the app says the session was archived
  // ********************************************************************
  await expectBrowserVsCodeUnavailable({ app, session }, "was archived");
  await expectOpeningToBeRefused({ app, session });
});

test("a session on an offline workspace cannot be opened in the browser VS Code", async () => {
  // ********************************************************************
  // ** GIVEN a session whose workspace's relay stopped
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  await app.theRelayStops();

  // ********************************************************************
  // ** WHEN the user asks to open it
  // ********************************************************************
  // ********************************************************************
  // ** THEN the app says the workspace is not connected
  // ********************************************************************
  await expectBrowserVsCodeUnavailable({ app, session }, "read-only");
  await expectOpeningToBeRefused({ app, session });
});
