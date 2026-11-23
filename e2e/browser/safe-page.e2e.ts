import { afterEach, test } from "bun:test";
import { opensTheSafePageInABrowser } from "../support/browser/safe-page.ts";
import { BROWSER_TEST_TIMEOUT_MS } from "../support/browser/start-app-in-browser.ts";
import { expectSafePageCallToBeAccepted } from "../support/expect/security-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test(
  "the recovery page calls the app with the secret it finds in the page",
  async () => {
    // ********************************************************************
    // ** GIVEN the app is running
    // ********************************************************************
    const app = await startAppWithLocalWorkspace();

    // ********************************************************************
    // ** WHEN the user opens the recovery page in a browser
    // ********************************************************************
    const page = await opensTheSafePageInABrowser(app);

    // ********************************************************************
    // ** THEN the page's script calls the app with the secret and is answered
    // ********************************************************************
    expectSafePageCallToBeAccepted(await page.nextCallWithTheCurrentSecret());
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a recovery page opened before the app restarted reloads once and uses the new secret",
  async () => {
    // ********************************************************************
    // ** GIVEN the recovery page open in a browser
    // ********************************************************************
    const app = await startAppWithLocalWorkspace();
    const page = await opensTheSafePageInABrowser(app);
    expectSafePageCallToBeAccepted(await page.nextCallWithTheCurrentSecret());

    // ********************************************************************
    // ** WHEN the app is restarted, which makes a new secret
    // ********************************************************************
    await app.restartsTheApp();

    // ********************************************************************
    // ** THEN the page recovers by itself and calls the app with the new secret
    // ********************************************************************
    expectSafePageCallToBeAccepted(await page.nextCallWithTheCurrentSecret());
  },
  BROWSER_TEST_TIMEOUT_MS,
);
