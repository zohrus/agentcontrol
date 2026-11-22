import { afterEach, test } from "bun:test";
import { expectAppToRefuse } from "../support/expect/app-refusal-expectations.ts";
import { expectSessionShownWithTitle } from "../support/expect/app-worktree-expectations.ts";
import { expectSessionWaitingForReply } from "../support/expect/app-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("the app shows one session with the title the user gave it", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent finished its turn
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  app.mockAgent.willReply("Done");
  const session = await app.user.startsSession({ prompt: "Tidy the readme" });
  await expectSessionWaitingForReply(app, session);

  // ********************************************************************
  // ** WHEN the user opens the session
  // ********************************************************************
  const summary = await app.user.looksUpSession(session);

  // ********************************************************************
  // ** THEN the app shows it with its title
  // ********************************************************************
  expectSessionShownWithTitle(summary, session);
});

test("opening a session that does not exist is answered as not found", async () => {
  // ********************************************************************
  // ** GIVEN a running app
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN the user opens a session that does not exist
  // ********************************************************************
  const outcome = await app.user.triesToLookUpASessionThatDoesNotExist();

  // ********************************************************************
  // ** THEN the app answers that the session was not found
  // ********************************************************************
  expectAppToRefuse(outcome, { status: 404, code: "session-not-found" });
});

test("an empty message to the agent is refused as an invalid request", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent finished its turn
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  app.mockAgent.willReply("Done");
  const session = await app.user.startsSession({ prompt: "Tidy the readme" });
  await expectSessionWaitingForReply(app, session);

  // ********************************************************************
  // ** WHEN the user sends an empty message
  // ********************************************************************
  const outcome = await app.user.triesToSendAnEmptyMessage(session);

  // ********************************************************************
  // ** THEN the app refuses it as an invalid request
  // ********************************************************************
  expectAppToRefuse(outcome, { status: 400, code: "invalid-request" });
});
