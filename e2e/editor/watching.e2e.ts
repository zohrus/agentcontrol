import { afterEach, test } from "bun:test";
import { expectFileChangeNotification } from "../support/expect/file-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

test("the app is told when the agent edits a file", async () => {
  // ********************************************************************
  // ** GIVEN an agent that does nothing on its first turn and edits src/server.ts on its second
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.onNextPrompt();
  relay.mockAgent.willEditFile("src/server.ts");
  // AND the user has a session, and watches its files after the first turn
  const session = await relay.user.startsSession({ prompt: "Get ready" });
  await relay.user.waitsForTheAgentToFinish(session);
  await relay.user.watchesFiles(session);

  // ********************************************************************
  // ** WHEN the user sends the next message and the agent edits src/server.ts
  // ********************************************************************
  await relay.user.sendsMessage(session, "Add a server");

  // ********************************************************************
  // ** THEN the app is told that src/server.ts changed
  // ********************************************************************
  await expectFileChangeNotification(relay, { session, path: "src/server.ts" });
});
