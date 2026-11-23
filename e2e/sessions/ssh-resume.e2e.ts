import { afterEach, setDefaultTimeout, test } from "bun:test";
import { expectSessionIdle } from "../support/expect/app-expectations.ts";
import {
  expectResumeToBeInTheHistory,
  expectSessionInterrupted,
} from "../support/expect/app-resume-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  resumesOnTheHost,
  startsSessionWaitingForAReplyOnTheHost,
} from "../support/setup/ssh-resume-setups.ts";

// Every ssh call is a real handshake, and the suite runs files side by side.
setDefaultTimeout(60_000);
afterEach(cleanUpAfterTest);

test("a session on an ssh workspace is interrupted when its relay is restarted, and can be resumed", async () => {
  // ********************************************************************
  // ** GIVEN a session on the ssh workspace whose agent said "Still here" and waits for a reply
  // ********************************************************************
  const setup = await startsSessionWaitingForAReplyOnTheHost();
  const { app, user, workspace, session } = setup;

  // ********************************************************************
  // ** WHEN the user restarts the relay of the workspace
  // ********************************************************************
  await user.restartsTheRelayOn(workspace);

  // ********************************************************************
  // ** THEN the session is listed as interrupted
  // ********************************************************************
  await expectSessionInterrupted(app, session);

  // ********************************************************************
  // ** WHEN the user resumes it
  // ********************************************************************
  await resumesOnTheHost(setup);

  // ********************************************************************
  // ** THEN the host runs a new agent for it, and the history says it was resumed
  // ********************************************************************
  await expectSessionIdle(app, session);
  await expectResumeToBeInTheHistory(app, { session, contextRestored: false });
});
