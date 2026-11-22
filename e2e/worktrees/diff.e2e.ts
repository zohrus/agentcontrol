import { afterEach, test } from "bun:test";
import { expectDiffToListChangedFile } from "../support/expect/diff-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startRelayWithSessionWhereAgentEdited } from "../support/setup/relay-sessions.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

test("the session diff lists a file the agent edited but did not commit", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will edit README.md without committing it
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willEditFile("README.md");

  // ********************************************************************
  // ** WHEN the user starts a session and the agent finishes its turn
  // ********************************************************************
  const session = await relay.user.startsSession({ prompt: "Reword the readme" });
  await relay.user.waitsForTheAgentToFinish(session);

  // ********************************************************************
  // ** THEN the session diff lists README.md
  // ********************************************************************
  await expectDiffToListChangedFile(relay, session, "README.md");
});

test("the session diff includes a new untracked file and a committed change together", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will create src/server.ts without committing it
  // ********************************************************************
  const { relay, session } = await startRelayWithSessionWhereAgentEdited("src/server.ts");
  // AND the agent has finished its turn in a new session

  // ********************************************************************
  // ** WHEN a change to README.md is committed on the session's branch
  // ********************************************************************
  await relay.user.commitsInTheWorktree(session, { path: "README.md", content: "# Demo app\n" });

  // ********************************************************************
  // ** THEN the session diff lists the new file
  // ********************************************************************
  await expectDiffToListChangedFile(relay, session, "src/server.ts");
  // AND it lists the committed change as well
  await expectDiffToListChangedFile(relay, session, "README.md");
});
