import { afterEach, test } from "bun:test";
import {
  expectSessionToHaveFile,
  expectSetupOutputToSay,
} from "../support/expect/default-base-expectations.ts";
import {
  expectNoMessageSentToTheAgent,
  expectSessionTitleToBe,
  expectSessionToBe,
  expectSessionToWaitFor,
} from "../support/expect/ready-session-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { theRepoSetupWaitsForTheTest } from "../support/setup/slow-setup.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("a session created without a prompt gets its worktree and is ready, not running or waiting", async () => {
  // ********************************************************************
  // ** GIVEN the app is running with one local workspace
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN the user creates a session and writes no prompt
  // ********************************************************************
  const session = await app.user.createsSessionWithoutAPrompt();

  // ********************************************************************
  // ** THEN the session becomes ready: its agent is up, and it is not waiting on the user
  // ********************************************************************
  await expectSessionToBe(app, { session, status: "ready" });
  // AND its worktree holds the repository's files
  await expectSessionToHaveFile(app, { session, path: "README.md", content: "# Demo\n" });
  // AND the agent was sent nothing
  await expectNoMessageSentToTheAgent(app, session);
});

test("the first prompt sent to a ready session starts its first turn and becomes its title", async () => {
  // ********************************************************************
  // ** GIVEN a ready session created without a prompt, and an agent that will reply
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  app.mockAgent.willReply("Rate limiting is in place");
  const session = await app.user.createsSessionWithoutAPrompt();
  await expectSessionToBe(app, { session, status: "ready" });

  // ********************************************************************
  // ** WHEN the user sends the first prompt
  // ********************************************************************
  await app.user.sendsMessage(session, "Add rate limiting");

  // ********************************************************************
  // ** THEN the agent answers and the session waits for the user's reply
  // ********************************************************************
  await expectSessionToWaitFor(app, { session, reason: "reply" });
  // AND the session is titled after the prompt
  await expectSessionTitleToBe(app, { session, title: "Add rate limiting" });
});

test("a session without a prompt is titled after its repository until the first prompt", async () => {
  // ********************************************************************
  // ** GIVEN the app is running with one local workspace
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN the user creates a session and writes no prompt
  // ********************************************************************
  const session = await app.user.createsSessionWithoutAPrompt();

  // ********************************************************************
  // ** THEN the session is titled with its repository's folder name and "new session"
  // ********************************************************************
  const folder = app.repoPath.split("/").at(-1) ?? "";
  await expectSessionTitleToBe(app, { session, title: `${folder} – new session` });
});

test("a session whose setup fails stays, and the setup output says why", async () => {
  // ********************************************************************
  // ** GIVEN a repo whose setup script waits for the test and then fails
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  const setup = await theRepoSetupWaitsForTheTest(app);

  // ********************************************************************
  // ** WHEN the user creates a session without a prompt and the setup fails
  // ********************************************************************
  const session = await app.user.createsSessionWithoutAPrompt();
  await setup.breaks();

  // ********************************************************************
  // ** THEN the session waits for a setup fix, and the setup output says what went wrong
  // ********************************************************************
  await expectSessionToWaitFor(app, { session, reason: "setup-failed" });
  await expectSetupOutputToSay(app, { session, text: "setup broke" });
});
