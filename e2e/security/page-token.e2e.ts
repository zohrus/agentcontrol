import { afterEach, test } from "bun:test";
import {
  expectAnswerToHoldNoSecret,
  expectClientToBeToldItsSecretIsOld,
  expectSessionListFromTheApp,
  expectPageNotToBeSniffed,
  expectPageToCarryTheToken,
  expectRequestAccepted,
  expectRequestRefusedAs,
} from "../support/expect/security-expectations.ts";
import {
  aClientHoldingAnOldSecret,
  theUiClientInAPageTheAppServed,
} from "../support/setup/page-client.ts";
import { startsAppServingBuiltUi } from "../support/setup/built-ui.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("a browser that loaded the app's page finds the secret in it and its calls work", async () => {
  // ********************************************************************
  // ** GIVEN a browser that has not opened the app yet
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  const browser = app.aBrowser();

  // ********************************************************************
  // ** WHEN the user opens the app's page and its script asks for the sessions
  // ********************************************************************
  const page = await browser.opensTheAppPage();
  const answer = await browser.listsTheSessions();

  // ********************************************************************
  // ** THEN the page carries the secret in its meta tag and sets no cookie
  // ********************************************************************
  expectPageToCarryTheToken({ page, app });
  // AND the call with that secret is accepted
  expectRequestAccepted(answer);
});

test("a browser that never loaded the app's page cannot call it", async () => {
  // ********************************************************************
  // ** GIVEN a browser that has not opened the app's page
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  const browser = app.aBrowser();

  // ********************************************************************
  // ** WHEN its script asks for the sessions
  // ********************************************************************
  const answer = await browser.listsTheSessions();

  // ********************************************************************
  // ** THEN the app refuses it as unauthorized
  // ********************************************************************
  expectRequestRefusedAs(answer, "unauthorized");
});

test("the session list and an HTML file of a worktree carry no secret", async () => {
  // ********************************************************************
  // ** GIVEN a session whose worktree holds an HTML file
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  const session = await app.user.startsSession({ prompt: "Make a page" });
  await app.user.editsAFileInTheWorktree(session, "page.html");

  // ********************************************************************
  // ** WHEN a local program reads the session list and that file
  // ********************************************************************
  const list = await app.aProgramWithTheToken.listsTheSessions();
  const file = await app.aProgramWithTheToken.readsAFileOfASession(session, "page.html");

  // ********************************************************************
  // ** THEN neither answer holds the secret or sets a cookie
  // ********************************************************************
  expectAnswerToHoldNoSecret({ answer: list, app });
  expectAnswerToHoldNoSecret({ answer: file, app });
});

test("the page of a built UI carries the secret too", async () => {
  // ********************************************************************
  // ** GIVEN the app is serving a folder of built UI files
  // ********************************************************************
  const app = await startsAppServingBuiltUi();

  // ********************************************************************
  // ** WHEN a browser opens the app's page
  // ********************************************************************
  const page = await app.aBrowser().opensTheAppPage();

  // ********************************************************************
  // ** THEN the page carries the secret in its meta tag
  // ********************************************************************
  expectPageToCarryTheToken({ page, app });
  // AND the page asks browsers not to guess its type
  expectPageNotToBeSniffed(page);
});

test("the SDK in a page the app served finds the secret in the meta tag on its own", async () => {
  // ********************************************************************
  // ** GIVEN a page the app served, with the secret in its meta tag
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  const client = theUiClientInAPageTheAppServed(app);

  // ********************************************************************
  // ** WHEN the UI's client, created without a token, asks for the sessions
  // ********************************************************************
  const sessions = await client.sessions.list();

  // ********************************************************************
  // ** THEN the app answers
  // ********************************************************************
  expectSessionListFromTheApp(sessions);
});

test("a client holding the secret from before a restart is told it is no longer accepted", async () => {
  // ********************************************************************
  // ** GIVEN a client that holds an old secret
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  const old = aClientHoldingAnOldSecret(app);

  // ********************************************************************
  // ** WHEN it asks for the sessions
  // ********************************************************************
  await old.client.sessions.list().catch(() => undefined);

  // ********************************************************************
  // ** THEN the app refuses it and the client is told once
  // ********************************************************************
  expectClientToBeToldItsSecretIsOld(old);
});

test("a link on another website opens the app's page, but that site's script cannot read it", async () => {
  // ********************************************************************
  // ** GIVEN the app is running
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN the user clicks a link to the app on another website, and that site's script fetches it
  // ********************************************************************
  const opened = await app.aLinkOnAnotherWebsite.opensTheAppPage();
  const fetched = await app.aLinkOnAnotherWebsite.readsTheAppPage();

  // ********************************************************************
  // ** THEN the page opens
  // ********************************************************************
  expectRequestAccepted(opened);
  // AND the script's fetch is refused as coming from another origin
  expectRequestRefusedAs(fetched, "forbidden-origin");
});
