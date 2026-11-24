import { afterEach, test } from "bun:test";
import {
  expectAgentToHaveAnsweredInitialize,
  expectSessionNotToHaveSaid,
  expectSessionToSay,
  expectStepToBeRunning,
} from "../support/expect/start-archive-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startsASessionWithoutABranch } from "../support/setup/create-at-once-setups.ts";
import { givesTheRepoARemoteThatHangs } from "../support/setup/hung-remote.ts";
import {
  anAdapterThatBootsWhenTheTestLets,
  EVERY_STEP_TAKES,
  startAppWhereEveryStepTakesTheSameTime,
} from "../support/setup/start-archive-setups.ts";

afterEach(cleanUpAfterTest);

test("starting a session says how long each step took", async () => {
  // ********************************************************************
  // ** GIVEN an app with a remote, a setup script, and a relay where every step takes 1.5 s
  // ********************************************************************
  const app = await startAppWhereEveryStepTakesTheSameTime();

  // ********************************************************************
  // ** WHEN the user starts a session
  // ********************************************************************
  const session = await startsASessionWithoutABranch(app);

  // ********************************************************************
  // ** THEN the session lists the steps of starting it, each with its time
  // ********************************************************************
  await expectSessionToSay(app, {
    session,
    lines: [
      `Asked origin: its default branch is main · ${EVERY_STEP_TAKES}`,
      `Fetched origin/main · ${EVERY_STEP_TAKES}`,
      `Checked out 2 files · ${EVERY_STEP_TAKES}`,
      `Copied 1 setup file · ${EVERY_STEP_TAKES}`,
      `Ran the setup script · ${EVERY_STEP_TAKES}`,
      `Started the mock adapter · ${EVERY_STEP_TAKES}`,
      `Opened the agent's session · ${EVERY_STEP_TAKES}`,
    ],
  });
});

test("a step that has not finished is announced as running, and ends with its time", async () => {
  // ********************************************************************
  // ** GIVEN a remote that does not answer, in a relay where every step takes 1.5 s
  // ********************************************************************
  const app = await startAppWhereEveryStepTakesTheSameTime({ remote: "none" });
  const remote = await givesTheRepoARemoteThatHangs(app.repoPath);

  // ********************************************************************
  // ** WHEN the user starts a session
  // ********************************************************************
  const session = await startsASessionWithoutABranch(app);

  // ********************************************************************
  // ** THEN the step that asks the remote is running, with no time yet
  // ********************************************************************
  await expectStepToBeRunning(app, { session, step: "trunk" });
  // AND once the remote answers the same step ends with its time
  await remote.answers();
  await expectSessionToSay(app, {
    session,
    lines: [`Asked origin: its default branch is main · ${EVERY_STEP_TAKES}`],
  });
});

test("the agent starts while the remote is still being asked", async () => {
  // ********************************************************************
  // ** GIVEN a remote that does not answer
  // ********************************************************************
  const app = await startAppWhereEveryStepTakesTheSameTime({ remote: "none" });
  await givesTheRepoARemoteThatHangs(app.repoPath);

  // ********************************************************************
  // ** WHEN the user starts a session
  // ********************************************************************
  const session = await startsASessionWithoutABranch(app);

  // ********************************************************************
  // ** THEN the agent's adapter has answered initialize, though git has fetched nothing yet
  // ********************************************************************
  await expectAgentToHaveAnsweredInitialize(app, session);
  await expectSessionNotToHaveSaid(app, { session, line: "Fetched origin/main" });
});

test("the worktree is made while the agent's adapter is still starting", async () => {
  // ********************************************************************
  // ** GIVEN an adapter that takes its time to start
  // ********************************************************************
  const app = await startAppWhereEveryStepTakesTheSameTime();
  const adapter = await anAdapterThatBootsWhenTheTestLets(app);

  // ********************************************************************
  // ** WHEN the user starts a session
  // ********************************************************************
  const session = await startsASessionWithoutABranch(app);

  // ********************************************************************
  // ** THEN the worktree is checked out and the setup script has run, before the adapter is up
  // ********************************************************************
  await expectSessionToSay(app, { session, lines: ["Ran the setup script"] });
  await expectSessionNotToHaveSaid(app, { session, line: "Started the mock adapter" });
  // AND once the adapter is up the session opens
  await adapter.boots();
  await expectSessionToSay(app, { session, lines: ["Opened the agent's session"] });
});
