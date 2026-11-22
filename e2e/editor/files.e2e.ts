import { afterEach, test } from "bun:test";
import {
  expectFileToRead,
  expectPathToBeRefusedAsOutsideTheWorktree,
  expectSaveToBeRefusedAsStale,
} from "../support/expect/file-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

async function startSessionWhereAgentEditedReadme() {
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willEditFile("README.md");
  const session = await relay.user.startsSession({ prompt: "Reword the readme" });
  await relay.user.waitsForTheAgentToFinish(session);
  return { relay, session };
}

test("reading a changed file at base and in the working copy returns the old and new content", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent replaced the content of README.md
  // ********************************************************************
  const { relay, session } = await startSessionWhereAgentEditedReadme();

  // ********************************************************************
  // ** WHEN the user opens README.md at its base version and its working copy
  // ********************************************************************
  const path = "README.md";

  // ********************************************************************
  // ** THEN the base version has the old content
  // ********************************************************************
  await expectFileToRead(relay, { session, path, ref: "base", content: "# Demo\n" });
  // AND the working copy has the new content
  await expectFileToRead(relay, { session, path, ref: "working", content: "// after\n" });
});

test("saving a file with the hash the user last saw succeeds", async () => {
  // ********************************************************************
  // ** GIVEN a session whose README.md the user has opened
  // ********************************************************************
  const { relay, session } = await startSessionWhereAgentEditedReadme();
  const path = "README.md";
  const seen = await relay.user.readsFile(session, { path, ref: "working" });

  // ********************************************************************
  // ** WHEN the user saves new content with the hash they saw
  // ********************************************************************
  await relay.user.savesFile(session, { path, content: "# Mine\n", hash: seen.hash });

  // ********************************************************************
  // ** THEN the working copy has the saved content
  // ********************************************************************
  await expectFileToRead(relay, { session, path, ref: "working", content: "# Mine\n" });
});

test("saving a file with a stale hash is refused", async () => {
  // ********************************************************************
  // ** GIVEN a session whose README.md the user opened, and then changed elsewhere
  // ********************************************************************
  const { relay, session } = await startSessionWhereAgentEditedReadme();
  const path = "README.md";
  const seen = await relay.user.readsFile(session, { path, ref: "working" });
  await relay.user.savesFile(session, { path, content: "# Elsewhere\n", hash: seen.hash });

  // ********************************************************************
  // ** WHEN the user saves with the hash they saw before the change
  // ********************************************************************
  const outcome = await relay.user.triesToSaveFile(session, {
    path,
    content: "# Mine\n",
    hash: seen.hash,
  });

  // ********************************************************************
  // ** THEN the save is refused because the file changed
  // ********************************************************************
  expectSaveToBeRefusedAsStale(outcome);
  // AND the other change is kept
  await expectFileToRead(relay, { session, path, ref: "working", content: "# Elsewhere\n" });
});

test("a path outside the worktree is refused", async () => {
  // ********************************************************************
  // ** GIVEN a running session
  // ********************************************************************
  const { relay, session } = await startSessionWhereAgentEditedReadme();

  // ********************************************************************
  // ** WHEN the user asks to read a file above the session's worktree
  // ********************************************************************
  const outcome = await relay.user.triesToReadFile(session, {
    path: "../../../etc/passwd",
    ref: "working",
  });

  // ********************************************************************
  // ** THEN the relay refuses, saying the path is outside the session's folder
  // ********************************************************************
  expectPathToBeRefusedAsOutsideTheWorktree(outcome);
});
