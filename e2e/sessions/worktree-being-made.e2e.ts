import { afterEach, test } from "bun:test";
import {
  expectFileToBeUnreadableYet,
  expectNoAgentActivityAfterArchiving,
  expectNothingToChangeYet,
  expectRefusedBecauseTheWorkingCopyCouldNotBeMade,
} from "../support/expect/worktree-being-made-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  archivesTheSession,
  asksForATerminalOfASessionBeingMade,
  asksForTheFileOfASessionBeingMade,
  aSecondSessionBecomesReady,
  aSessionBeingMadeWhoseBranchIsTaken,
  startAppWithShell,
  startsASessionWhoseSetupWaits,
} from "../support/setup/worktree-being-made-setups.ts";
import { givesTheRepoARemoteThatHangs } from "../support/setup/hung-remote.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";
import { startsASessionWithoutABranch } from "../support/setup/create-at-once-setups.ts";

afterEach(cleanUpAfterTest);

test("a session whose worktree is still being made has no changes and no files, and says its file is not ready", async () => {
  // ********************************************************************
  // ** GIVEN a session being created while the remote hangs
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  await givesTheRepoARemoteThatHangs(app.repoPath);
  const session = await startsASessionWithoutABranch(app);

  // ********************************************************************
  // ** WHEN a client asks for its changes, its files and one file
  // ********************************************************************
  const unreadable = await asksForTheFileOfASessionBeingMade(app, session);

  // ********************************************************************
  // ** THEN it has no changes and no files, and the file is said not to be made yet
  // ********************************************************************
  await expectNothingToChangeYet(app, session);
  expectFileToBeUnreadableYet(unreadable);
});

test("a terminal asked for while the worktree is being made is refused when the worktree cannot be made", async () => {
  // ********************************************************************
  // ** GIVEN a session being created while the remote hangs, whose worktree branch is taken
  // ********************************************************************
  const app = await startAppWithShell();
  const remote = await givesTheRepoARemoteThatHangs(app.repoPath);
  const session = await aSessionBeingMadeWhoseBranchIsTaken(app);

  // ********************************************************************
  // ** WHEN a client asks for a terminal and then the remote answers, so the worktree fails
  // ********************************************************************
  const shell = asksForATerminalOfASessionBeingMade(app, session);
  await remote.answers();

  // ********************************************************************
  // ** THEN the terminal is refused because the working copy could not be made
  // ********************************************************************
  await expectRefusedBecauseTheWorkingCopyCouldNotBeMade(shell);
  // AND a terminal asked for afterwards is refused the same way, and the session has no changes
  await expectRefusedBecauseTheWorkingCopyCouldNotBeMade(
    asksForATerminalOfASessionBeingMade(app, session),
  );
  await expectNothingToChangeYet(app, session);
});

test("a session archived while its setup runs does not start an agent afterwards", async () => {
  // ********************************************************************
  // ** GIVEN a session whose setup script is still running
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  const { session, setup } = await startsASessionWhoseSetupWaits(app);

  // ********************************************************************
  // ** WHEN the user archives it and then the setup ends
  // ********************************************************************
  await archivesTheSession(app, session);
  await setup.finishes();

  // ********************************************************************
  // ** THEN no agent starts for it, even after another session has gone all the way to ready
  // ********************************************************************
  await aSecondSessionBecomesReady(app);
  await expectNoAgentActivityAfterArchiving(app, session);
});
