import { afterEach, test } from "bun:test";
import { expectSessionListToShow } from "../support/browser/recovery-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "a tab opened before the app restarted picks up the new secret by itself and shows new sessions",
  async () => {
    // ********************************************************************
    // ** GIVEN the app is open in a browser tab and showing a session
    // ********************************************************************
    const app = await startAppInBrowser();
    const first = await app.user.startsSession({ prompt: "First task" });
    await expectSessionListToShow(app, first.title);

    // ********************************************************************
    // ** WHEN the app is restarted (it makes a new secret) and a session is started
    // ********************************************************************
    await app.restartsTheApp();
    const second = await app.user.startsSession({ prompt: "Second task" });

    // ********************************************************************
    // ** THEN the tab recovers without the user doing anything and lists both sessions
    // ********************************************************************
    await expectSessionListToShow(app, second.title);
    await expectSessionListToShow(app, first.title);
  },
  BROWSER_TEST_TIMEOUT_MS,
);
