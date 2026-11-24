import { afterEach, test } from "bun:test";
import {
  expectSessionToHaveFile,
  expectSessionToStartFrom,
  expectSetupOutputToSay,
} from "../support/expect/default-base-expectations.ts";
import {
  expectSessionToBe,
  expectSessionToWaitFor,
} from "../support/expect/ready-session-expectations.ts";
import {
  expectCreationToBeRefused,
  expectExactlyOneToHaveBeenCreated,
  expectTheIdToBeRefused,
  expectFileChangesToBeHeard,
  expectSessionToBeListedAsStarting,
} from "../support/expect/create-at-once-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  aSessionWhoseWorktreeBranchIsTaken,
  anId,
  createsFromAMissingBranch,
  createsWithTheSameIdTwiceAtOnce,
  tryToCreateWithId,
  writesANewFile,
  startsASessionWithoutABranch,
  theUserChoosesTheSessionId,
} from "../support/setup/create-at-once-setups.ts";
import { givesTheRepoARemoteThatHangs } from "../support/setup/hung-remote.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("a session is created and listed as starting while the remote has not answered, and records where it started once it has", async () => {
  // ********************************************************************
  // ** GIVEN a repository whose remote hangs
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  const remote = await givesTheRepoARemoteThatHangs(app.repoPath);

  // ********************************************************************
  // ** WHEN the user creates a session and names no branch
  // ********************************************************************
  const session = await startsASessionWithoutABranch(app);

  // ********************************************************************
  // ** THEN the session is listed as starting, with no base yet
  // ********************************************************************
  await expectSessionToBeListedAsStarting(app, session);
  // AND once the remote answers the session is ready and says where it started from
  await remote.answers();
  await expectSessionToBe(app, { session, status: "ready" });
  await expectSessionToStartFrom(app, { session, base: "origin/main" });
});

test("a session started with an id the client chose has that id, and a second one with it is refused", async () => {
  // ********************************************************************
  // ** GIVEN the app is running with one local workspace
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN the client creates a session with an id of its own
  // ********************************************************************
  const session = await theUserChoosesTheSessionId(app);

  // ********************************************************************
  // ** THEN the session has that id
  // ********************************************************************
  await expectSessionToBe(app, { session, status: "ready" });
  // AND creating another session with the same id is refused
  await expectCreationToBeRefused(app, { id: session.id, saying: "exists already" });
});

test("when the worktree cannot be made the session says so as a failed setup instead of failing to exist", async () => {
  // ********************************************************************
  // ** GIVEN a branch with the name the session's worktree branch will have is taken
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  const id = await aSessionWhoseWorktreeBranchIsTaken(app);

  // ********************************************************************
  // ** WHEN the user creates that session
  // ********************************************************************
  const session = await theUserChoosesTheSessionId(app, id);

  // ********************************************************************
  // ** THEN the session waits for the user because its setup failed
  // ********************************************************************
  await expectSessionToWaitFor(app, { session, reason: "setup-failed" });
  // AND the setup output says why
  await expectSetupOutputToSay(app, { session, text: "already exists" });
});

test("files of a session are watched from the moment its worktree exists, even when they were asked for before", async () => {
  // ********************************************************************
  // ** GIVEN a session being created while the remote hangs, whose files the user already asked for
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  const remote = await givesTheRepoARemoteThatHangs(app.repoPath);
  const session = await startsASessionWithoutABranch(app);
  await app.sdk.files.tree(session.id);

  // ********************************************************************
  // ** WHEN the remote answers and a file appears in the worktree
  // ********************************************************************
  await remote.answers();
  await expectSessionToBe(app, { session, status: "ready" });

  // ********************************************************************
  // ** THEN the app hears about the change
  // ********************************************************************
  await expectFileChangesToBeHeard(app, { session, path: "NOTES.md" });
});

test("an id that is not a UUID is refused, because it would name a folder and a branch", async () => {
  // ********************************************************************
  // ** GIVEN the app is running with one local workspace
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN a client asks for a session with an id that climbs out of the data folder
  // ********************************************************************
  const outcome = await tryToCreateWithId(app, "../../elsewhere");

  // ********************************************************************
  // ** THEN the app refuses it
  // ********************************************************************
  expectTheIdToBeRefused(outcome);
});

test("a file written to a session whose worktree is still being made waits for the worktree", async () => {
  // ********************************************************************
  // ** GIVEN a session being created while the remote hangs
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  const remote = await givesTheRepoARemoteThatHangs(app.repoPath);
  const session = await startsASessionWithoutABranch(app);

  // ********************************************************************
  // ** WHEN a client writes a new file to it and the remote then answers
  // ********************************************************************
  const written = writesANewFile(app, { session, path: "NOTES.md", content: "notes\n" });
  await remote.answers();
  await written;

  // ********************************************************************
  // ** THEN the session is ready and its worktree holds the file
  // ********************************************************************
  await expectSessionToBe(app, { session, status: "ready" });
  await expectSessionToHaveFile(app, { session, path: "NOTES.md", content: "notes\n" });
});

test("two requests that create a session with the same id at once create one", async () => {
  // ********************************************************************
  // ** GIVEN the app is running with one local workspace
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN a client sends the same create request twice without waiting for the first
  // ********************************************************************
  const outcomes = await createsWithTheSameIdTwiceAtOnce(app);

  // ********************************************************************
  // ** THEN exactly one of them created the session
  // ********************************************************************
  expectExactlyOneToHaveBeenCreated(outcomes);
});

test("an id whose creation was refused can be used again", async () => {
  // ********************************************************************
  // ** GIVEN a session with an id of the client's choice that was refused for its base branch
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  const id = anId();
  await createsFromAMissingBranch(app, id);

  // ********************************************************************
  // ** WHEN the client asks again with the same id and no base branch
  // ********************************************************************
  const session = await theUserChoosesTheSessionId(app, id);

  // ********************************************************************
  // ** THEN the session is created and becomes ready
  // ********************************************************************
  await expectSessionToBe(app, { session, status: "ready" });
});
