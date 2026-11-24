import { afterEach, test } from "bun:test";
import { expectPageToReactAtEveryStep } from "../support/browser/reaction-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { walkthroughSteps } from "../support/browser/walkthrough-steps.ts";
import { expectSessionWaitingForReply } from "../support/expect/app-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "every screen, tab and session a user walks through reacts at once",
  async () => {
    // ********************************************************************
    // ** GIVEN two sessions that edited README.md and replied, the first open in a browser
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willEditFile("README.md");
    app.mockAgent.willReply("Reworded");
    const first = await app.user.startsSession({ prompt: "Reword the readme" });
    const second = await app.user.startsSession({ prompt: "Reword it again" });
    await expectSessionWaitingForReply(app, first);
    await expectSessionWaitingForReply(app, second);
    await app.page.opensSession(first.title);

    // ********************************************************************
    // ** WHEN the user switches sessions and opens each tab and screen in turn
    // ********************************************************************
    // ********************************************************************
    // ** THEN each one shows its content straight away
    // ********************************************************************
    await expectPageToReactAtEveryStep(app, walkthroughSteps({ app, other: second }));
  },
  BROWSER_TEST_TIMEOUT_MS,
);
