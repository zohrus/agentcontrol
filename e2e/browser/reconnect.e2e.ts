import { afterEach, test } from "bun:test";
import {
  expectBrowserToBeConnected,
  expectStreamToShowOnce,
} from "../support/browser/browser-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "after the app restarts the browser reconnects and shows the whole history without duplicates",
  async () => {
    // ********************************************************************
    // ** GIVEN a session open in the browser whose agent answered "First answer"
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willReply("First answer");
    // AND the agent will answer the next message with "Second answer"
    app.mockAgent.onNextPrompt();
    app.mockAgent.willReply("Second answer");
    const session = await app.user.startsSession({ prompt: "Say hello" });
    await app.page.opensSession(session.title);
    await expectStreamToShowOnce(app, "First answer");

    // ********************************************************************
    // ** WHEN the app is restarted and the user sends another message
    // ********************************************************************
    await app.restartsTheApp();
    await expectBrowserToBeConnected(app);
    await app.user.sendsMessage(session, "And again?");

    // ********************************************************************
    // ** THEN the conversation shows the second answer once
    // ********************************************************************
    await expectStreamToShowOnce(app, "Second answer");
    // AND still shows the first answer once, with no reload
    await expectStreamToShowOnce(app, "First answer");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
