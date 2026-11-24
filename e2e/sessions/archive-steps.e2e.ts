import { afterEach, test } from "bun:test";
import {
  expectAgentToHaveBeenKilled,
  expectFilesToWaitForDeletion,
  expectGitToForgetTheWorktreeButKeepTheBranch,
  expectNothingToWaitForDeletion,
  expectSessionToBeArchived,
  expectSessionToSay,
} from "../support/expect/start-archive-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startsASessionWithoutABranch } from "../support/setup/create-at-once-setups.ts";
import {
  aDeletionThatWaitsForTheTest,
  EVERY_STEP_TAKES,
  startAppWhereEveryStepTakesTheSameTime,
  startAppWithAReadySession,
  theRepoIgnoresNodeModules,
  theRepoRunsASetupScript,
  theWorktreeFolderIsMovedAway,
} from "../support/setup/start-archive-setups.ts";
import { archivesTheSession } from "../support/setup/worktree-being-made-setups.ts";

afterEach(cleanUpAfterTest);

test("archiving says how long each step took, the deletion of the old folder included", async () => {
  // ********************************************************************
  // ** GIVEN a ready session in a relay where every step takes 1.5 s
  // ********************************************************************
  const { app, session } = await startAppWithAReadySession();

  // ********************************************************************
  // ** WHEN the user archives it
  // ********************************************************************
  await archivesTheSession(app, session);

  // ********************************************************************
  // ** THEN the session lists the steps of archiving it, each with its time
  // ********************************************************************
  await expectSessionToSay(app, {
    session,
    lines: [
      `No uncommitted changes · ${EVERY_STEP_TAKES}`,
      `Stopped the agent · ${EVERY_STEP_TAKES}`,
      `Closed terminals · ${EVERY_STEP_TAKES}`,
      `Removed the worktree (its folder is deleted in the background) · ${EVERY_STEP_TAKES}`,
    ],
  });
  // AND the deletion of the old folder, which came after, says its time too
  await expectSessionToSay(app, {
    session,
    lines: [`Deleted the old worktree folder · ${EVERY_STEP_TAKES}`],
  });
});

test("an archived session leaves the list while its old folder is still being deleted", async () => {
  // ********************************************************************
  // ** GIVEN a ready session in a relay that waits before deleting an archived folder
  // ********************************************************************
  const held = await aDeletionThatWaitsForTheTest();
  const { app, session } = await startAppWithAReadySession({ relayEnv: held.relayEnv });

  // ********************************************************************
  // ** WHEN the user archives it
  // ********************************************************************
  await archivesTheSession(app, session);

  // ********************************************************************
  // ** THEN the session is archived, git forgot the worktree and kept the branch
  // ********************************************************************
  await expectSessionToBeArchived(app, session);
  await expectGitToForgetTheWorktreeButKeepTheBranch(app, session);
  // AND the files of the old folder still wait to be deleted
  await expectFilesToWaitForDeletion(app, session);
  // AND once the deletion goes on, nothing is left
  await held.deletion.goesOn();
  await expectNothingToWaitForDeletion(app, session);
});

test("a relay that is restarted while a folder waits to be deleted deletes it when it starts", async () => {
  // ********************************************************************
  // ** GIVEN an archived session whose old folder has not been deleted yet
  // ********************************************************************
  const held = await aDeletionThatWaitsForTheTest();
  const { app, session } = await startAppWithAReadySession({ relayEnv: held.relayEnv });
  await archivesTheSession(app, session);
  await expectFilesToWaitForDeletion(app, session);

  // ********************************************************************
  // ** WHEN the relay stops and starts again
  // ********************************************************************
  await app.theRelayStops();
  await app.theRelayStartsAgain();

  // ********************************************************************
  // ** THEN the old folder is deleted
  // ********************************************************************
  await expectNothingToWaitForDeletion(app, session);
});

test("archiving a session whose folder is already gone forgets the worktree in git", async () => {
  // ********************************************************************
  // ** GIVEN a ready session whose folder was moved away, as when a relay stopped halfway through archiving
  // ********************************************************************
  const { app, session } = await startAppWithAReadySession();
  await theWorktreeFolderIsMovedAway(app, session);

  // ********************************************************************
  // ** WHEN the user archives it
  // ********************************************************************
  await archivesTheSession(app, session);

  // ********************************************************************
  // ** THEN the session is archived, git forgot the worktree and kept the branch
  // ********************************************************************
  await expectSessionToBeArchived(app, session);
  await expectGitToForgetTheWorktreeButKeepTheBranch(app, session);
});

test("a big ignored folder made by the setup script is no uncommitted change", async () => {
  // ********************************************************************
  // ** GIVEN a repo that ignores node_modules, whose setup script fills it with 3,000 files
  // ********************************************************************
  const script = `bun -e 'for (let i = 0; i < 3000; i++) await Bun.write("node_modules/p" + (i % 30) + "/f" + i + ".js", "x")'`;
  const app = await startAppWhereEveryStepTakesTheSameTime();
  await theRepoIgnoresNodeModules(app);
  await theRepoRunsASetupScript(app, script);
  const session = await startsASessionWithoutABranch(app);
  await expectSessionToSay(app, { session, lines: ["Opened the agent's session"] });

  // ********************************************************************
  // ** WHEN the user archives it without forcing (the app refuses if it sees uncommitted files)
  // ********************************************************************
  await archivesTheSession(app, session);

  // ********************************************************************
  // ** THEN it is archived, with no warning about the ignored files
  // ********************************************************************
  await expectSessionToBeArchived(app, session);
});

test("archiving a session whose agent ignores the request to stop kills it", async () => {
  // ********************************************************************
  // ** GIVEN a ready session whose agent ignores the request to stop
  // ********************************************************************
  const { app, session } = await startAppWithAReadySession({
    agent: (agent) => {
      agent.ignoresTheStopSignal();
    },
  });

  // ********************************************************************
  // ** WHEN the user archives it
  // ********************************************************************
  await archivesTheSession(app, session);

  // ********************************************************************
  // ** THEN the agent was killed and the session is archived
  // ********************************************************************
  await expectAgentToHaveBeenKilled(app, session);
  await expectSessionToBeArchived(app, session);
});
