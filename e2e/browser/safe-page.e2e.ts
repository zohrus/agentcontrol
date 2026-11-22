import { afterEach, test } from "bun:test";
import { expectRequestBoxToHold } from "../support/expect/safe-page-expectations.ts";
import { opensTheSafePageInABrowser } from "../support/browser/safe-page.ts";
import { BROWSER_TEST_TIMEOUT_MS } from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithModifiableUi } from "../support/setup/modify-app.ts";

afterEach(cleanUpAfterTest);

test(
  "the recovery page keeps what the user typed when its status changes",
  async () => {
    // ********************************************************************
    // ** GIVEN the recovery page is open and the user has typed a request they have not sent
    // ********************************************************************
    const app = await startAppWithModifiableUi();
    app.mockAgent.willWaitUntilCancelled();
    const page = await opensTheSafePageInABrowser(app);
    await page.typesInTheRequestBox("make the header blue");

    // ********************************************************************
    // ** WHEN the Modify agent starts working on another request, so the status changes
    // ********************************************************************
    await app.user.asksToModifyTheUi("add a cost column");
    await page.waitsForTheStatusToSay("Status: working");

    // ********************************************************************
    // ** THEN the request box still holds what the user typed
    // ********************************************************************
    await expectRequestBoxToHold(page, "make the header blue");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
