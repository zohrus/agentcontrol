import { afterEach, test } from "bun:test";
import {
  expectSessionRowToSay,
  expectStreamToShowAll,
} from "../support/browser/page-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "reads and searches in a row collapse into one line that opens to list each call",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that reads two files and searches once before it replies
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willReadFile("README.md");
    app.mockAgent.willReadFile("package.json");
    app.mockAgent.willSearchFor("rate limit");
    app.mockAgent.willReply("Found it");
    const session = await app.user.startsSession({ prompt: "Where is the limit set?" });

    // ********************************************************************
    // ** WHEN the user opens the session
    // ********************************************************************
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** THEN the conversation shows one line for the three lookups
    // ********************************************************************
    await expectStreamToShowAll(app, "Read 2 files, searched 1 time", "Found it");
    // AND opening that line lists each call
    await app.page.opensTheCollapsedLookups();
    await expectStreamToShowAll(app, "Read README.md", "Read package.json", "Search rate limit");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the conversation shows the agent's thinking, plan, mode change, notice and the end of the turn",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that thinks, plans, switches mode and posts a notice before it replies
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willThink("Checking the layout first");
    app.mockAgent.willPlan("Read the code", "Write the test");
    app.mockAgent.willChangeModeTo("plan");
    app.mockAgent.willShowNotice("Heads up", "Rate limits are per key");
    app.mockAgent.willReply("Ready");
    const session = await app.user.startsSession({ prompt: "Plan the work" });

    // ********************************************************************
    // ** WHEN the user opens the session
    // ********************************************************************
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** THEN each of them has its own line in the conversation
    // ********************************************************************
    await expectStreamToShowAll(app, "Thinking · Checking the layout first");
    await expectStreamToShowAll(app, "Read the code", "Write the test", "Mode: plan");
    // AND the notice and the end of the turn are there too
    await expectStreamToShowAll(app, "Heads up: Rate limits are per key", "Turn ended · end_turn");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the conversation says when the agent exited on its own and with which code",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that dies in the middle of its turn
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willExitUnexpectedly();
    const session = await app.user.startsSession({ prompt: "Do something risky" });

    // ********************************************************************
    // ** WHEN the user opens the session
    // ********************************************************************
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** THEN the conversation says the agent exited with code 3
    // ********************************************************************
    await expectStreamToShowAll(app, "The agent exited (exit code 3)");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the output of a worktree setup script is shown and its success is noted",
  async () => {
    // ********************************************************************
    // ** GIVEN a repository whose setup script prints a line
    // ********************************************************************
    const app = await startAppInBrowser();
    await app.user.setsTheRepoSetupScript("echo preparing the copy");

    // ********************************************************************
    // ** WHEN the user starts a session and opens it
    // ********************************************************************
    const session = await app.user.startsSession({ prompt: "Add rate limiting" });
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** THEN the conversation notes that the worktree setup finished
    // ********************************************************************
    await expectStreamToShowAll(app, "Worktree setup finished");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a failing worktree setup script is flagged on the session's row and shows its output",
  async () => {
    // ********************************************************************
    // ** GIVEN a repository whose setup script prints an error and fails
    // ********************************************************************
    const app = await startAppInBrowser();
    await app.user.setsTheRepoSetupScript("echo the copy is broken; exit 3");

    // ********************************************************************
    // ** WHEN the user starts a session and opens it
    // ********************************************************************
    const session = await app.user.startsSession({ prompt: "Add rate limiting" });
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** THEN the row says the setup failed
    // ********************************************************************
    await expectSessionRowToSay(app, { title: session.title, text: "setup failed" });
    // AND the conversation shows the exit code and the script's output
    await expectStreamToShowAll(app, "Worktree setup failed (exit 3)", "the copy is broken");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
