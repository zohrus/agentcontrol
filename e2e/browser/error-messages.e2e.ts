import { afterEach, test } from "bun:test";
import {
  expectConnectionToSay,
  expectNoToasts,
  expectToastToShow,
} from "../support/browser/page-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "a session that cannot start from a base branch that does not exist says why in a message",
  async () => {
    // ********************************************************************
    // ** GIVEN the app is open in a browser
    // ********************************************************************
    const app = await startAppInBrowser();

    // ********************************************************************
    // ** WHEN the user starts a session from a base branch that does not exist
    // ********************************************************************
    const mock = { repoPath: app.repoPath, agent: "Mock agent", prompt: "Add rate limiting" };
    await app.page.startsSession({ ...mock, baseBranch: "no-such-branch" });

    // ********************************************************************
    // ** THEN a message says the base branch is not a git reference
    // ********************************************************************
    await expectToastToShow(app, "invalid reference: no-such-branch");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a message in the corner goes away by itself after a few seconds",
  async () => {
    // ********************************************************************
    // ** GIVEN a message in the corner, in a browser whose clock can be moved forward
    // ********************************************************************
    const app = await startAppInBrowser({ controllableClock: true });
    await app.page.triesToAddRepository("/no/such/folder");
    await expectToastToShow(app, "Something went wrong inside AgentControl.");

    // ********************************************************************
    // ** WHEN ten seconds pass
    // ********************************************************************
    await app.page.letsTimePass(10_000);

    // ********************************************************************
    // ** THEN the message is gone
    // ********************************************************************
    await expectNoToasts(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "while the app is away the status bar says it is reconnecting, and connected once it is back",
  async () => {
    // ********************************************************************
    // ** GIVEN the app is open in a browser, and a dropped live connection cannot be made again yet
    // ********************************************************************
    const app = await startAppInBrowser();
    await app.page.cannotReachTheLiveStream();

    // ********************************************************************
    // ** WHEN the app quits and starts again
    // ********************************************************************
    await app.restartsTheApp();

    // ********************************************************************
    // ** THEN the status bar says Reconnecting…
    // ********************************************************************
    await expectConnectionToSay(app, "Reconnecting");
    // AND once the page can reach the app again it says Connected
    await app.page.canReachTheLiveStreamAgain();
    await expectConnectionToSay(app, "Connected");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "when the network is gone an action says AgentControl cannot be reached",
  async () => {
    // ********************************************************************
    // ** GIVEN the app is open in a browser
    // ********************************************************************
    const app = await startAppInBrowser();

    // ********************************************************************
    // ** WHEN the network goes away and the user opens Config
    // ********************************************************************
    await app.page.losesTheNetwork();
    await app.page.opensWorkspaceSetup();

    // ********************************************************************
    // ** THEN a message says AgentControl cannot be reached and keeps trying
    // ********************************************************************
    await expectToastToShow(app, "AgentControl cannot be reached right now.");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "an answer the page cannot read is reported as a problem in the page",
  async () => {
    // ********************************************************************
    // ** GIVEN the app is open in a browser, and its answers to the setup check are garbled
    // ********************************************************************
    const app = await startAppInBrowser();
    await app.page.getsGarbageFrom("/api/workspace/check");

    // ********************************************************************
    // ** WHEN the user opens Config
    // ********************************************************************
    await app.page.opensWorkspaceSetup();

    // ********************************************************************
    // ** THEN a message says something went wrong in the page and to try again
    // ********************************************************************
    await expectToastToShow(app, "Something went wrong in the page.");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a file whose contents the page cannot read is reported in a message",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose agent edited README.md, and file contents that arrive garbled
    // ********************************************************************
    const app = await startAppInBrowser();
    await app.page.getsUnreadableFileContents();
    app.mockAgent.willEditFile("README.md");
    const session = await app.user.startsSession({ prompt: "Reword the readme" });

    // ********************************************************************
    // ** WHEN the user opens the session, which shows its first changed file
    // ********************************************************************
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** THEN a message says something went wrong in the page
    // ********************************************************************
    await expectToastToShow(app, "Something went wrong in the page.");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
