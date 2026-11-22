import { afterEach, test } from "bun:test";
import { expectRawMessagesKeptNextToUpdates } from "../support/expect/raw-message-expectations.ts";
import {
  eventsReadThroughSdk,
  eventsStreamedToApp,
  expectFileEditAsUpdate,
  expectPermissionRequestDescribed,
  expectReplyAsUpdate,
  expectTurnEndedAsUpdate,
  expectUninterpretedUpdate,
} from "../support/expect/update-expectations.ts";
import { expectSessionWaitingForReply } from "../support/expect/app-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("the SDK history serves the agent's reply and the finished turn as normalised updates", async () => {
  // ********************************************************************
  // ** GIVEN the app is running and the agent will reply "Config is fine"
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  app.mockAgent.willReply("Config is fine");

  // ********************************************************************
  // ** WHEN the user starts a session and its turn finishes
  // ********************************************************************
  const session = await app.user.startsSession({ prompt: "Review the config" });
  await expectSessionWaitingForReply(app, session);

  // ********************************************************************
  // ** THEN the history read through the SDK holds the reply as an agent-text update
  // ********************************************************************
  const history = eventsReadThroughSdk(app, session);
  await expectReplyAsUpdate(history, "Config is fine");
  // AND the finished turn as a turn-ended update
  await expectTurnEndedAsUpdate(history, "end_turn");
  // AND every ACP event still holds its raw message
  await expectRawMessagesKeptNextToUpdates(history);
});

test("the SDK history serves a file edit with its diff and an uninterpreted kind as other", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will edit src/server.ts and report compacting its context
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  app.mockAgent.willEditFile("src/server.ts");
  app.mockAgent.willCompactContext();

  // ********************************************************************
  // ** WHEN the user starts a session and its turn finishes
  // ********************************************************************
  const session = await app.user.startsSession({ prompt: "Add a server" });
  await expectSessionWaitingForReply(app, session);

  // ********************************************************************
  // ** THEN the history holds the edit with the text before and after
  // ********************************************************************
  const history = eventsReadThroughSdk(app, session);
  const edit = { path: "src/server.ts", oldText: "// before\n", newText: "// after\n" };
  await expectFileEditAsUpdate(history, edit);
  // AND the compaction as an `other` update with its name
  await expectUninterpretedUpdate(history, "compaction_update");
});

test("the SDK history describes a pending permission request as a tool call", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will ask permission to run `npm test`
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  app.mockAgent.willAskToRunCommand("npm test");

  // ********************************************************************
  // ** WHEN the user starts a session
  // ********************************************************************
  const session = await app.user.startsSession({ prompt: "Run the tests" });

  // ********************************************************************
  // ** THEN the history describes an execute call to run `npm test`
  // ********************************************************************
  const tool = { title: "Run npm test", kind: "execute", command: "npm test" };
  await expectPermissionRequestDescribed(eventsReadThroughSdk(app, session), tool);
});

test("the live stream delivers normalised updates as they happen", async () => {
  // ********************************************************************
  // ** GIVEN the app is running and the agent will reply "Streaming now"
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  app.mockAgent.willReply("Streaming now");

  // ********************************************************************
  // ** WHEN the user starts a session
  // ********************************************************************
  const session = await app.user.startsSession({ prompt: "Stream it" });

  // ********************************************************************
  // ** THEN the live stream delivered the reply as an agent-text update
  // ********************************************************************
  await expectReplyAsUpdate(eventsStreamedToApp(app, session), "Streaming now");
});
