import { afterEach, test } from "bun:test";
import {
  expectBackgroundToBe,
  expectConnectionToSay,
  expectDialogToShow,
  expectElapsedTimeToShow,
  expectNoDialogToBeOpen,
} from "../support/browser/page-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * HOUR_MS;

test(
  "the page follows the computer's light or dark colors",
  async () => {
    // ********************************************************************
    // ** GIVEN the app is open in a browser on a computer set to dark colors
    // ********************************************************************
    const app = await startAppInBrowser({ colorScheme: "dark" });
    await expectBackgroundToBe(app, "rgb(17, 20, 26)");

    // ********************************************************************
    // ** WHEN the computer switches to light colors
    // ********************************************************************
    await app.page.switchesToLightColors();

    // ********************************************************************
    // ** THEN the page background turns light
    // ********************************************************************
    await expectBackgroundToBe(app, "rgb(246, 247, 249)");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the header counts how long a session has been going, from seconds up to days",
  async () => {
    // ********************************************************************
    // ** GIVEN a session open in a browser whose clock can be moved forward
    // ********************************************************************
    const app = await startAppInBrowser({ controllableClock: true });
    const session = await app.user.startsSession({ prompt: "Add rate limiting" });
    await app.page.opensSession(session.title);
    await expectElapsedTimeToShow(app, /^\d+s$/);

    // ********************************************************************
    // ** WHEN three hours and five minutes pass, and then two days more
    // ********************************************************************
    await app.page.letsTimePass(3 * HOUR_MS + 5 * MINUTE_MS + MINUTE_MS / 2);
    await expectElapsedTimeToShow(app, /^3h 05m$/);
    await app.page.letsTimePass(2 * DAY_MS + HOUR_MS);

    // ********************************************************************
    // ** THEN the header shows days and hours
    // ********************************************************************
    await expectElapsedTimeToShow(app, /^2d 4h$/);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "Analytics tells the user it is not ready yet and closes with OK",
  async () => {
    // ********************************************************************
    // ** GIVEN the app is open in a browser
    // ********************************************************************
    const app = await startAppInBrowser();

    // ********************************************************************
    // ** WHEN the user presses Analytics
    // ********************************************************************
    await app.page.opensAnalytics();

    // ********************************************************************
    // ** THEN a notice says analytics is not ready yet, and OK closes it
    // ********************************************************************
    await expectDialogToShow(app, "Analytics is not ready yet.");
    await app.page.dismissesTheNotice();
    await expectNoDialogToBeOpen(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a browser that cannot store anything does not reload in circles when the app's secret changes",
  async () => {
    // ********************************************************************
    // ** GIVEN the app is open in a browser that refuses to store anything
    // ********************************************************************
    const app = await startAppInBrowser({ storageBlocked: true });
    const refused = app.page.watchesForARefusedSecret();

    // ********************************************************************
    // ** WHEN the app restarts and makes a new secret, and the page's old one is refused
    // ********************************************************************
    await app.restartsTheApp();
    await refused;

    // ********************************************************************
    // ** THEN the page stays as it is and says it is reconnecting, instead of reloading again and again
    // ********************************************************************
    await expectConnectionToSay(app, "Reconnecting");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
