import { afterEach, test } from "bun:test";
import {
  expectArchiveToWarnAboutFiles,
  expectSessionListedAsArchived,
  expectSessionNotArchived,
  expectWorktreeRemovedButBranchKept,
} from "../support/expect/archive-expectations.ts";
import { expectSessionHistoryToBeReplayed } from "../support/expect/session-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

async function startSessionWithUncommittedFile() {
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willEditFile("src/server.ts");
  const session = await relay.user.startsSession({ prompt: "Add a server" });
  await relay.user.waitsForTheAgentToFinish(session);
  return { relay, session };
}

test("archiving a session with uncommitted changes warns and lists the files instead of archiving", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent left src/server.ts uncommitted
  // ********************************************************************
  const { relay, session } = await startSessionWithUncommittedFile();

  // ********************************************************************
  // ** WHEN the user archives the session
  // ********************************************************************
  const result = await relay.user.archivesSession(session);

  // ********************************************************************
  // ** THEN the relay warns about src/server.ts
  // ********************************************************************
  expectArchiveToWarnAboutFiles(result, ["src/server.ts"]);
  // AND the session is not archived and its worktree is still there
  await expectSessionNotArchived(relay, session);
});

test("archiving anyway removes the worktree and keeps the branch", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent left src/server.ts uncommitted
  // ********************************************************************
  const { relay, session } = await startSessionWithUncommittedFile();

  // ********************************************************************
  // ** WHEN the user archives the session anyway
  // ********************************************************************
  await relay.user.archivesSessionAnyway(session);

  // ********************************************************************
  // ** THEN the worktree folder is gone but the session's branch is kept
  // ********************************************************************
  await expectWorktreeRemovedButBranchKept(relay, session);
});

test("an archived session stays in the list and its events can still be read", async () => {
  // ********************************************************************
  // ** GIVEN a session that the user has archived anyway
  // ********************************************************************
  const { relay, session } = await startSessionWithUncommittedFile();
  await relay.user.archivesSessionAnyway(session);

  // ********************************************************************
  // ** WHEN the user reopens the app and follows the session from its start
  // ********************************************************************
  await relay.closesTheApp();
  relay.opensTheApp();
  await relay.followsSessionAfter(session, 0);

  // ********************************************************************
  // ** THEN the session is listed as archived
  // ********************************************************************
  await expectSessionListedAsArchived(relay, session);
  // AND its history is still replayed
  await expectSessionHistoryToBeReplayed(relay, session);
});
