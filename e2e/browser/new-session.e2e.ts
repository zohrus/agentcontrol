import { afterEach, test } from "bun:test";
import {
  expectSessionListed,
  expectStreamToShow,
} from "../support/browser/browser-expectations.ts";
import { startAppInBrowser } from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test("a new session can be started from the New session dialog and its agent's reply appears", async () => {
  // ********************************************************************
  // ** GIVEN the app is open in a browser, with no repository added yet
  // ********************************************************************
  const app = await startAppInBrowser();
  // AND the agent will reply "Rate limiting is in place"
  app.mockAgent.willReply("Rate limiting is in place");
  await app.mockAgent.writeScript();

  // ********************************************************************
  // ** WHEN the user adds the repository in the New session dialog and starts a session
  // ********************************************************************
  await app.page.startsSession({
    repoPath: app.repoPath,
    agent: "Mock agent",
    prompt: "Add rate limiting",
  });

  // ********************************************************************
  // ** THEN the session list shows the new session
  // ********************************************************************
  await expectSessionListed(app, "Add rate limiting");
  // AND the open conversation shows the agent's reply
  await expectStreamToShow(app, "Rate limiting is in place");
});
