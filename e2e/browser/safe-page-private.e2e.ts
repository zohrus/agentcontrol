import { afterEach, test } from "bun:test";
import { opensTheSafePageWhereStorageIsRefused } from "../support/browser/safe-page-private.ts";
import { BROWSER_TEST_TIMEOUT_MS } from "../support/browser/start-app-in-browser.ts";
import { expectNoErrorsInThePage } from "../support/expect/safe-page-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test(
  "the recovery page keeps working when the browser refuses session storage",
  async () => {
    // ********************************************************************
    // ** GIVEN the recovery page open in a window whose session storage refuses every use
    // ********************************************************************
    const app = await startAppWithLocalWorkspace();
    const page = await opensTheSafePageWhereStorageIsRefused(app);

    // ********************************************************************
    // ** WHEN the app restarts, so the page's secret is out of date, and the page checks again
    // ********************************************************************
    await app.restartsTheApp();
    await page.waitsForItToCheckTheApp(2);

    // ********************************************************************
    // ** THEN nothing went wrong in the page's script
    // ********************************************************************
    expectNoErrorsInThePage(page.errorsInThePage());
  },
  BROWSER_TEST_TIMEOUT_MS,
);
