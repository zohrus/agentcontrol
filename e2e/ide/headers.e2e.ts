import { afterEach, test } from "bun:test";
import {
  expectAnswerHeader,
  expectCodeServerToSeeTheBrowsersHostAndOrigin,
} from "../support/expect/ide-header-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithCodeServer } from "../support/setup/ide-setups.ts";
import { opensBrowserVsCode } from "../support/setup/ide-user.ts";

afterEach(cleanUpAfterTest);

test("code-server sees the Host and Origin the browser sent, so its own origin check passes", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const tab = await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** WHEN the page sends a request with its own Origin
  // ********************************************************************
  // ********************************************************************
  // ** THEN code-server sees the same Host and Origin
  // ********************************************************************
  await expectCodeServerToSeeTheBrowsersHostAndOrigin(tab);
});

test("headers and cookies code-server sets reach the browser unchanged", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const tab = await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** WHEN the page asks for a path where code-server sets a cookie and a header
  // ********************************************************************
  // ********************************************************************
  // ** THEN both arrive
  // ********************************************************************
  await expectAnswerHeader(tab, { path: "cookie", header: "set-cookie", value: "fake=1" });
  await expectAnswerHeader(tab, { path: "cookie", header: "x-fake", value: "yes" });
});

test("answers tell the browser not to send the address as a referrer", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const tab = await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** WHEN the workbench page is loaded
  // ********************************************************************
  // ********************************************************************
  // ** THEN its answer says "no-referrer", so the ticket in the address stays out of links
  // ********************************************************************
  await expectAnswerHeader(tab, { path: "", header: "referrer-policy", value: "no-referrer" });
});
