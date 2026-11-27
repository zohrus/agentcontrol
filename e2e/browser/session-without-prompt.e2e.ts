import { afterEach, test } from "bun:test";
import { expectStreamToShow } from "../support/browser/browser-expectations.ts";
import { expectMessageBoxToHold } from "../support/browser/message-box-expectations.ts";
import { aSessionWithAQueuedFirstPrompt } from "../support/browser/queued-prompt-setups.ts";
import { expectPageToShow } from "../support/browser/page-expectations.ts";
import { expectQueueToHold } from "../support/browser/queue-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

const REPO = { agent: "Mock agent" };

test(
  "a session is created from the dialog without a prompt, and the first prompt is written in the session",
  async () => {
    // ********************************************************************
    // ** GIVEN the app is open in a browser, and the agent will reply
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willReply("Rate limiting is in place");
    await app.mockAgent.writeScript();
    await app.user.setsTheRepoSetupScript("echo preparing the copy");

    // ********************************************************************
    // ** WHEN the user creates a session in the dialog, with no prompt field to fill in
    // ********************************************************************
    await app.page.createsSession({ ...REPO, repoPath: app.repoPath });

    // ********************************************************************
    // ** THEN the new session opens, ready for its first prompt, with its setup shown
    // ********************************************************************
    await expectPageToShow(app, "new session", "ready", "Worktree setup finished");
    // AND the user writes the first prompt there and sends it
    await app.page.sendsTheFirstPrompt("Add rate limiting");
    // AND the agent's reply appears in the conversation
    await expectStreamToShow(app, "Rate limiting is in place");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a prompt sent while the session is still being set up is queued and sent when it is ready",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose setup is still running, with a first prompt already sent
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willReply("Rate limiting is in place");
    const setup = await aSessionWithAQueuedFirstPrompt(app, "Add rate limiting");

    // ********************************************************************
    // ** WHEN the setup finishes
    // ********************************************************************
    await setup.finishes();

    // ********************************************************************
    // ** THEN the queued prompt is delivered and the agent replies
    // ********************************************************************
    await expectStreamToShow(app, "Rate limiting is in place");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "when the setup fails the session says so and the message the user wrote stays unsent in the queue",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose setup is still running, with a first prompt already sent
    // ********************************************************************
    const app = await startAppInBrowser();
    const setup = await aSessionWithAQueuedFirstPrompt(app, "Add rate limiting");

    // ********************************************************************
    // ** WHEN the setup fails
    // ********************************************************************
    await setup.breaks();

    // ********************************************************************
    // ** THEN the session shows the failure, and the setup output once the user opens the line
    // ********************************************************************
    await expectPageToShow(app, "Worktree setup failed");
    await app.page.opensTheSetupOutput();
    await expectPageToShow(app, "setup broke");
    // AND the message was not sent and is still in the queue, where it can be edited
    await expectPageToShow(app, "Not sent: the session did not become ready.");
    await expectQueueToHold(app, "Add rate limiting");
    // AND a message written now joins the queue behind it, instead of overtaking it
    await app.page.sendsMessage("Then fix the tests");
    await expectQueueToHold(app, "Add rate limiting", "Then fix the tests");
    await app.page.editsTheQueuedMessage("Add rate limiting");
    await expectMessageBoxToHold(app, "Add rate limiting");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
