import { afterEach, test } from "bun:test";
import {
  expectAppRefusal,
  expectCodeServerOnlyOnAPrivateSocket,
  expectNoAppSecretIn,
} from "../support/expect/ide-access-expectations.ts";
import { expectOneCodeServerStarted } from "../support/expect/ide-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { asksForAnIdeAddressWithoutTheSecret } from "../support/setup/ide-outsiders.ts";
import { relayDataOf, startAppWithCodeServer } from "../support/setup/ide-setups.ts";
import { opensBrowserVsCode } from "../support/setup/ide-user.ts";

afterEach(cleanUpAfterTest);

test("the page the IDE serves holds none of the app's secret", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const tab = await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** WHEN the workbench page is loaded
  // ********************************************************************
  const page = await (await tab.loads("")).text();

  // ********************************************************************
  // ** THEN neither the app's token nor its token tag is in it
  // ********************************************************************
  expectNoAppSecretIn(page, app.token);
});

test("asking for an address without the app's secret is refused", async () => {
  // ********************************************************************
  // ** GIVEN a session on a workspace with code-server
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();

  // ********************************************************************
  // ** WHEN another program asks the app for the session's IDE address with no secret
  // ********************************************************************
  const answer = await asksForAnIdeAddressWithoutTheSecret(app, session.id);

  // ********************************************************************
  // ** THEN the app refuses it as unauthorized
  // ********************************************************************
  expectAppRefusal(answer, "unauthorized");
});

test("code-server listens on a private socket only, never on a port", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** WHEN code-server's flags and the permissions of its socket are read
  // ********************************************************************
  const running = await expectOneCodeServerStarted(relayDataOf(app));

  // ********************************************************************
  // ** THEN it has a socket of mode 600 in a private folder, and no TCP flags
  // ********************************************************************
  await expectCodeServerOnlyOnAPrivateSocket(relayDataOf(app), running);
});
