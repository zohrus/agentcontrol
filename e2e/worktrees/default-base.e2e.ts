import { afterEach, test } from "bun:test";
import {
  expectNoChangesInTheDiff,
  expectSessionToHaveFile,
  expectSessionToStartFrom,
  expectSetupOutputToSay,
} from "../support/expect/default-base-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  aTeammatePushesAFile,
  givesTheRepoAnUnreachableRemote,
  givesTheRepoARemote,
  theRemoteCannotBeReached,
  theRepoFetchesItsRemote,
} from "../support/setup/repo-remote.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

const NEWS = { path: "NEWS.md", content: "Released on the remote\n" };

/** The app with a repo whose remote has a commit the repo's own main does not have yet. */
async function startAppWhoseRemoteTrunkIsAhead() {
  const app = await startAppWithLocalWorkspace();
  const remote = await givesTheRepoARemote(app.repoPath);
  await aTeammatePushesAFile(remote, NEWS);
  return { app, remote };
}

test("a session started without a branch has the newest commit of the remote's trunk", async () => {
  // ********************************************************************
  // ** GIVEN a repo whose remote trunk is ahead of the repo's own main
  // ********************************************************************
  const { app } = await startAppWhoseRemoteTrunkIsAhead();

  // ********************************************************************
  // ** WHEN the user starts a session and names no branch
  // ********************************************************************
  const session = await app.user.startsSessionWithoutABranch({ prompt: "Add rate limiting" });

  // ********************************************************************
  // ** THEN the session's worktree has the file the remote's newest commit added
  // ********************************************************************
  await expectSessionToHaveFile(app, { session, path: NEWS.path, content: NEWS.content });
});

test("a session started from the remote's trunk shows no changes and names that trunk as its base", async () => {
  // ********************************************************************
  // ** GIVEN a repo whose remote trunk is ahead of the repo's own main
  // ********************************************************************
  const { app } = await startAppWhoseRemoteTrunkIsAhead();

  // ********************************************************************
  // ** WHEN the user starts a session and names no branch
  // ********************************************************************
  const session = await app.user.startsSessionWithoutABranch({ prompt: "Add rate limiting" });

  // ********************************************************************
  // ** THEN the session shows no changes
  // ********************************************************************
  await expectNoChangesInTheDiff(app, session);
  // AND it says it started from origin/main
  await expectSessionToStartFrom(app, { session, base: "origin/main" });
  // AND its setup output says the same
  await expectSetupOutputToSay(app, { session, text: "Started from the latest origin/main." });
});

test("a session in a repo without a remote starts from the local branch and says so", async () => {
  // ********************************************************************
  // ** GIVEN a repo that has no remote
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN the user starts a session and names no branch
  // ********************************************************************
  const session = await app.user.startsSessionWithoutABranch({ prompt: "Add rate limiting" });

  // ********************************************************************
  // ** THEN the setup output says there is no remote and the local main was used
  // ********************************************************************
  const text = "This repository has no remote, so the session starts from the local main.";
  await expectSetupOutputToSay(app, { session, text });
  // AND the session shows no changes against that main
  await expectNoChangesInTheDiff(app, session);
  await expectSessionToStartFrom(app, { session, base: "main" });
});

test("when the remote cannot be reached a session starts from the last known trunk and says it may be out of date", async () => {
  // ********************************************************************
  // ** GIVEN a repo that fetched its remote's newest commit, and a remote that is now unreachable
  // ********************************************************************
  const { app } = await startAppWhoseRemoteTrunkIsAhead();
  await theRepoFetchesItsRemote(app.repoPath);
  await theRemoteCannotBeReached(app.repoPath);

  // ********************************************************************
  // ** WHEN the user starts a session and names no branch
  // ********************************************************************
  const session = await app.user.startsSessionWithoutABranch({ prompt: "Add rate limiting" });

  // ********************************************************************
  // ** THEN the setup output says the last known origin/main was used and may be out of date
  // ********************************************************************
  const text = "so the session starts from the last known origin/main, which may be out of date.";
  await expectSetupOutputToSay(app, { session, text });
  // AND the worktree has the newest commit the repo knew about
  await expectSessionToHaveFile(app, { session, path: NEWS.path, content: NEWS.content });
  await expectSessionToStartFrom(app, { session, base: "origin/main" });
});

test("when the remote cannot be reached and was never fetched a session starts from the local branch and says so", async () => {
  // ********************************************************************
  // ** GIVEN a repo whose remote has never been reachable
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  await givesTheRepoAnUnreachableRemote(app.repoPath);

  // ********************************************************************
  // ** WHEN the user starts a session and names no branch
  // ********************************************************************
  const session = await app.user.startsSessionWithoutABranch({ prompt: "Add rate limiting" });

  // ********************************************************************
  // ** THEN the setup output says origin could not be reached and the local main was used
  // ********************************************************************
  const text = "and it has no known branch, so the session starts from the local main.";
  await expectSetupOutputToSay(app, { session, text });
  await expectSessionToStartFrom(app, { session, base: "main" });
});

test("a session that names a branch starts from that branch, not from the remote's trunk", async () => {
  // ********************************************************************
  // ** GIVEN a repo whose remote trunk is ahead of the repo's own main
  // ********************************************************************
  const { app } = await startAppWhoseRemoteTrunkIsAhead();

  // ********************************************************************
  // ** WHEN the user starts a session from the local main
  // ********************************************************************
  const session = await app.user.startsSessionFromBranch({
    prompt: "Add rate limiting",
    baseBranch: "main",
  });

  // ********************************************************************
  // ** THEN the session has no file from the remote's newer commit
  // ********************************************************************
  await expectSessionToStartFrom(app, { session, base: "main" });
  await expectSessionToHaveFile(app, { session, path: "README.md", content: "# Demo\n" });
  await expectNoChangesInTheDiff(app, session);
});
