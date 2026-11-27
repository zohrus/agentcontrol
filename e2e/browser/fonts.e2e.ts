import { afterEach, test } from "bun:test";
import {
  expectFontStackToStartWith,
  expectFontToBeLoaded,
  expectNothingToBeFetchedFromOutside,
  expectPageTextToBeSetIn,
} from "../support/browser/fonts-expectations.ts";
import { startsSessionThatOnlyReplied } from "../support/browser/open-session-setups.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "the page text is set in Inter, which the app serves itself",
  async () => {
    // ********************************************************************
    // ** GIVEN the app is running
    // ********************************************************************
    // ********************************************************************
    // ** WHEN the user opens it in a browser
    // ********************************************************************
    const app = await startAppInBrowser();

    // ********************************************************************
    // ** THEN the text is set in Inter, the browser has loaded its font file, and nothing was
    // ** fetched from any address but the app's own
    // ********************************************************************
    await expectPageTextToBeSetIn(app.page, "Inter");
    await expectFontToBeLoaded(app.page, "Inter");
    expectNothingToBeFetchedFromOutside(app.page);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "code, such as the repository path and the branch, is set in JetBrains Mono",
  async () => {
    // ********************************************************************
    // ** GIVEN a session open in a browser
    // ********************************************************************
    const app = await startAppInBrowser();
    const session = await startsSessionThatOnlyReplied(app, "Check the readme");
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** WHEN the user opens the session's details
    // ********************************************************************
    await app.page.opensTheDetails();

    // ********************************************************************
    // ** THEN the repository path is set in JetBrains Mono, whose font file the browser loaded
    // ********************************************************************
    await expectFontStackToStartWith(app.page, {
      selector: '[role="dialog"] .font-mono',
      family: "JetBrains Mono",
    });
    await expectFontToBeLoaded(app.page, "JetBrains Mono");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
