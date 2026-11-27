import { afterEach, test } from "bun:test";
import { aFilledInNewSessionDialog } from "../support/browser/new-session-setups.ts";
import { expectPageToShow } from "../support/browser/page-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { givesTheRepoARemoteThatHangs } from "../support/setup/hung-remote.ts";
import { givesTheRepoARemote } from "../support/setup/repo-remote.ts";
import {
  EVERY_STEP_TAKES,
  EVERY_STEP_TAKES_MS,
  theRepoRunsASetupScript,
} from "../support/setup/start-archive-setups.ts";

afterEach(cleanUpAfterTest);

/** The relay's environment that makes every step report the same duration. */
const EVERY_STEP_TAKES_THE_SAME = { AGENTCONTROL_STEP_MS: String(EVERY_STEP_TAKES_MS) };

test(
  "the setup line of a new session gives the total and opens into the steps with their times",
  async () => {
    // ********************************************************************
    // ** GIVEN the app in a browser, with a remote and a setup script, where every step takes 1.5 s
    // ********************************************************************
    const app = await startAppInBrowser({ relayEnv: EVERY_STEP_TAKES_THE_SAME });
    await givesTheRepoARemote(app.repoPath);
    await theRepoRunsASetupScript(app, "echo built");

    // ********************************************************************
    // ** WHEN the user creates a session and it is ready
    // ********************************************************************
    await aFilledInNewSessionDialog(app);
    await app.page.createsTheSession();
    await expectPageToShow(app, "ready", "Worktree setup finished ·");

    // ********************************************************************
    // ** THEN opening the setup line lists the steps with their times
    // ********************************************************************
    await app.page.opensTheSetupOutput();
    await expectPageToShow(app, "Fetched origin/main", "Checked out 2 files", EVERY_STEP_TAKES);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a step that is still running shows as running with the time it has taken so far",
  async () => {
    // ********************************************************************
    // ** GIVEN a remote that does not answer
    // ********************************************************************
    const app = await startAppInBrowser({ relayEnv: EVERY_STEP_TAKES_THE_SAME });
    const remote = await givesTheRepoARemoteThatHangs(app.repoPath);

    // ********************************************************************
    // ** WHEN the user creates a session
    // ********************************************************************
    await aFilledInNewSessionDialog(app);
    await app.page.createsTheSession();

    // ********************************************************************
    // ** THEN the setup line says the worktree is being set up, with the step that is running
    // ********************************************************************
    await expectPageToShow(
      app,
      "Setting up the worktree…",
      "Asking origin for its default branch…",
    );
    // AND once the remote answers, the step ends with its time
    await remote.answers();
    await expectPageToShow(app, "Worktree setup finished ·");
    await app.page.opensTheSetupOutput();
    await expectPageToShow(app, "Asked origin: its default branch is main", EVERY_STEP_TAKES);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "an archived session shows how long archiving took and its steps",
  async () => {
    // ********************************************************************
    // ** GIVEN a ready session in a browser, where every step takes 1.5 s
    // ********************************************************************
    const app = await startAppInBrowser({ relayEnv: EVERY_STEP_TAKES_THE_SAME });
    await givesTheRepoARemote(app.repoPath);
    await aFilledInNewSessionDialog(app);
    await app.page.createsTheSession();
    await expectPageToShow(app, "ready", "Worktree setup finished ·");

    // ********************************************************************
    // ** WHEN the user archives it, and opens it under Archived
    // ********************************************************************
    await app.page.archives();
    await app.page.showsArchivedSessions();
    await app.page.opensTheFirstListedSession();

    // ********************************************************************
    // ** THEN the stream says it was archived, and opens into the steps of archiving
    // ********************************************************************
    await expectPageToShow(app, "Archived ·");
    await app.page.opensTheArchiveSteps();
    await expectPageToShow(app, "Stopped the agent", "Closed terminals", "Removed the worktree");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
