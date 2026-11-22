import { afterEach, test } from "bun:test";
import { ErrorCode } from "@agentcontrol/protocol";
import { expectFileToRead } from "../support/expect/file-expectations.ts";
import { expectRefusal } from "../support/expect/refusal-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

test("a file committed on the session's branch reads differently at base and at head", async () => {
  // ********************************************************************
  // ** GIVEN a session where README.md was committed with new content
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willReply("Ready");
  const session = await relay.user.startsSession({ prompt: "Look at the readme" });
  await relay.user.waitsForTheAgentToFinish(session);
  await relay.user.commitsInTheWorktree(session, { path: "README.md", content: "# Committed\n" });

  // ********************************************************************
  // ** WHEN the user opens README.md at its base version and at head
  // ********************************************************************
  const path = "README.md";

  // ********************************************************************
  // ** THEN the base version has the old content
  // ********************************************************************
  await expectFileToRead(relay, { session, path, ref: "base", content: "# Demo\n" });
  // AND the head version has the committed content
  await expectFileToRead(relay, { session, path, ref: "head", content: "# Committed\n" });
});

test("reading a file the agent created at the base version is refused", async () => {
  // ********************************************************************
  // ** GIVEN a session where the agent created src/server.ts
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willEditFile("src/server.ts");
  const session = await relay.user.startsSession({ prompt: "Add a server" });
  await relay.user.waitsForTheAgentToFinish(session);

  // ********************************************************************
  // ** WHEN the user opens src/server.ts at its base version
  // ********************************************************************
  const outcome = await relay.user.triesToReadFile(session, { path: "src/server.ts", ref: "base" });

  // ********************************************************************
  // ** THEN the relay says the file does not exist at that version
  // ********************************************************************
  expectRefusal(outcome, {
    code: ErrorCode.internalError,
    saying: "does not exist at that version",
  });
});
