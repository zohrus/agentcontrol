import { afterEach, test } from "bun:test";
import { expectAppRefusal, expectRefusal } from "../support/expect/ide-access-expectations.ts";
import { expectIdeToAnswer } from "../support/expect/ide-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithCodeServer } from "../support/setup/ide-setups.ts";
import { appOutsiderOnTheIdeOrigin, ideOutsidersOf } from "../support/setup/ide-outsiders.ts";
import { opensBrowserVsCode, tabAt } from "../support/setup/ide-user.ts";

afterEach(cleanUpAfterTest);

test("an address with a ticket the app never gave out is refused", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const tab = await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** WHEN a page asks for the same port with a made-up ticket
  // ********************************************************************
  const guessed = tabAt(`${tab.origin}/${"x".repeat(32)}/`);

  // ********************************************************************
  // ** THEN the answer is a plain refusal
  // ********************************************************************
  await expectIdeToAnswer(guessed, { path: "", status: 404 });
});

test("the IDE's port serves nothing without a ticket, neither a page nor the app's API", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const outsider = ideOutsidersOf(await opensBrowserVsCode(app, session));

  // ********************************************************************
  // ** WHEN another program asks that port for its root and for /api/sessions
  // ********************************************************************
  const root = await outsider.asksForTheRoot();
  const api = await outsider.asksForTheAppsApi();

  // ********************************************************************
  // ** THEN both are refused with the same "not found"
  // ********************************************************************
  expectRefusal(root, 404);
  expectRefusal(api, 404);
});

test("an address stops working once its lifetime has passed", async () => {
  // ********************************************************************
  // ** GIVEN an app whose browser VS Code addresses last no time at all
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer({ previewLifetimeMs: 0 });

  // ********************************************************************
  // ** WHEN the user opens the browser VS Code and the page loads
  // ********************************************************************
  const tab = await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** THEN the expired address is refused
  // ********************************************************************
  await expectIdeToAnswer(tab, { path: "", status: 404 });
});

test("a request that names another host is refused, so DNS rebinding cannot use the address", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const outsider = ideOutsidersOf(await opensBrowserVsCode(app, session));

  // ********************************************************************
  // ** WHEN a request with a valid ticket arrives for the host "evil.example"
  // ********************************************************************
  const answer = await outsider.asksUnderTheTicketWithAnotherHost();

  // ********************************************************************
  // ** THEN it is refused
  // ********************************************************************
  expectRefusal(answer, 403);
});

test("another website cannot use the address, even with its ticket", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const outsider = ideOutsidersOf(await opensBrowserVsCode(app, session));

  // ********************************************************************
  // ** WHEN a script on another website fetches the address, and opens a WebSocket to it
  // ********************************************************************
  const fetched = await outsider.asksUnderTheTicketFromAnotherWebsite();
  const socket = await outsider.opensASocketFromAnotherWebsite();

  // ********************************************************************
  // ** THEN both are refused
  // ********************************************************************
  expectRefusal(fetched, 403);
  expectRefusal(socket, 403);
});

test("the app refuses the IDE's origin, even when the request carries the app's secret", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const outsider = appOutsiderOnTheIdeOrigin({ app, tab: await opensBrowserVsCode(app, session) });

  // ********************************************************************
  // ** WHEN a page on the IDE's origin calls the app's API with the secret
  // ********************************************************************
  const api = await outsider.callsTheApiWithTheSecret();

  // ********************************************************************
  // ** THEN the app refuses the origin
  // ********************************************************************
  expectAppRefusal(api, "forbidden-origin");
});

test("the app's page, which carries its secret, cannot be read from the IDE's origin", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const outsider = appOutsiderOnTheIdeOrigin({ app, tab: await opensBrowserVsCode(app, session) });

  // ********************************************************************
  // ** WHEN a page on the IDE's origin asks the app for its page
  // ********************************************************************
  const page = await outsider.readsTheAppsPage();

  // ********************************************************************
  // ** THEN the app refuses the origin
  // ********************************************************************
  expectAppRefusal(page, "forbidden-origin");
});
