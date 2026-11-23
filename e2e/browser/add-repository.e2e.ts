import { afterEach, test } from "bun:test";
import { expectRepositoryFolderToStayForRetry } from "../support/browser/add-repository-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "adding a folder that does not exist tells the user in plain words and keeps the folder field to correct",
  async () => {
    // ********************************************************************
    // ** GIVEN the app is open in a browser, with no repository added yet
    // ********************************************************************
    const app = await startAppInBrowser();

    // ********************************************************************
    // ** WHEN the user types a folder that does not exist under Add repository
    // ********************************************************************
    await app.page.triesToAddRepository("/no/such/folder");

    // ********************************************************************
    // ** THEN a message says it is not a folder on this computer
    // ********************************************************************
    await expectRepositoryFolderToStayForRetry(app, {
      folder: "/no/such/folder",
      notice: "is not a folder on this computer",
    });
  },
  BROWSER_TEST_TIMEOUT_MS,
);
