import { afterEach, test } from "bun:test";
import { expectSessionWaitingForReply } from "../support/expect/app-expectations.ts";
import {
  expectDiffToList,
  expectLiveStreamToReportChange,
  expectTreeToList,
} from "../support/expect/app-worktree-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("the file tree of a session lists the repo's files", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent finished its turn
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  app.mockAgent.willReply("Done");
  const session = await app.user.startsSession({ prompt: "Look around" });
  await expectSessionWaitingForReply(app, session);

  // ********************************************************************
  // ** WHEN the user opens the file tree
  // ********************************************************************
  const entries = await app.user.listsTheFiles(session);

  // ********************************************************************
  // ** THEN the tree lists README.md
  // ********************************************************************
  expectTreeToList(entries, "README.md");
});

test("the diff of a session lists a file the agent edited", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent edited README.md
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  app.mockAgent.willEditFile("README.md");
  const session = await app.user.startsSession({ prompt: "Reword the readme" });
  await expectSessionWaitingForReply(app, session);

  // ********************************************************************
  // ** WHEN the user opens the diff
  // ********************************************************************
  const diff = await app.user.readsTheDiff(session);

  // ********************************************************************
  // ** THEN the diff lists README.md
  // ********************************************************************
  expectDiffToList(diff, "README.md");
});

test("a file changed outside the app is reported on the live stream", async () => {
  // ********************************************************************
  // ** GIVEN a session whose file tree the user has open
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  app.mockAgent.willReply("Done");
  const session = await app.user.startsSession({ prompt: "Look around" });
  await expectSessionWaitingForReply(app, session);
  await app.user.listsTheFiles(session);

  // ********************************************************************
  // ** WHEN a file in the session's worktree is edited from outside the app
  // ********************************************************************
  await app.user.editsAFileInTheWorktree(session, "notes.md");

  // ********************************************************************
  // ** THEN the live stream reports that notes.md changed
  // ********************************************************************
  await expectLiveStreamToReportChange(app, { session, path: "notes.md" });
});
