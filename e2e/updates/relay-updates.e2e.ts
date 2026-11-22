import { afterEach, test } from "bun:test";
import {
  expectRawMessagesKeptNextToUpdates,
  expectRawReplyUnchanged,
} from "../support/expect/raw-message-expectations.ts";
import {
  eventsStreamedByRelay,
  expectFileEditAsUpdate,
  expectPermissionRequestDescribed,
  expectPlanAsUpdate,
  expectReplyAsUpdate,
  expectThoughtAsUpdate,
  expectToolToReach,
  expectTurnEndedAsUpdate,
  expectUninterpretedUpdate,
  expectUsageFromUpdates,
  expectUserMessageAsUpdate,
} from "../support/expect/update-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

test("the agent's reply, its thought and the user's message arrive as normalised updates", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will think "Check the config", then reply "Config is fine"
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willThink("Check the config");
  relay.mockAgent.willReply("Config is fine");

  // ********************************************************************
  // ** WHEN the user starts a session and the agent finishes its turn
  // ********************************************************************
  const session = await relay.user.startsSession({ prompt: "Review the config" });
  await relay.user.waitsForTheAgentToFinish(session);

  // ********************************************************************
  // ** THEN the relay delivered the reply as an agent-text update
  // ********************************************************************
  const events = eventsStreamedByRelay(relay, session);
  await expectReplyAsUpdate(events, "Config is fine");
  // AND the thought as an agent-thought update
  await expectThoughtAsUpdate(events, "Check the config");
  // AND the user's prompt as a user-text update
  await expectUserMessageAsUpdate(events, "Review the config");
});

test("the agent's plan arrives as a normalised plan update", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will plan two tasks
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willPlan("Write the test", "Make it pass");

  // ********************************************************************
  // ** WHEN the user starts a session and the agent finishes its turn
  // ********************************************************************
  const session = await relay.user.startsSession({ prompt: "Add a feature" });
  await relay.user.waitsForTheAgentToFinish(session);

  // ********************************************************************
  // ** THEN the relay delivered a plan update with both tasks, pending
  // ********************************************************************
  const events = eventsStreamedByRelay(relay, session);
  await expectPlanAsUpdate(events, ["Write the test", "Make it pass"]);
});

test("a file edit arrives as a normalised tool update with its diff", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will edit src/server.ts
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willEditFile("src/server.ts");

  // ********************************************************************
  // ** WHEN the user starts a session and the agent finishes its turn
  // ********************************************************************
  const session = await relay.user.startsSession({ prompt: "Add a server" });
  await relay.user.waitsForTheAgentToFinish(session);

  // ********************************************************************
  // ** THEN the relay delivered an edit of src/server.ts with the text before and after
  // ********************************************************************
  const events = eventsStreamedByRelay(relay, session);
  const edit = { path: "src/server.ts", oldText: "// before\n", newText: "// after\n" };
  await expectFileEditAsUpdate(events, edit);
  // AND the tool call is reported completed
  await expectToolToReach(events, "completed");
});

test("a permission request is described as the tool call it concerns", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will ask permission to run `npm test`
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willAskToRunCommand("npm test");

  // ********************************************************************
  // ** WHEN the user starts a session
  // ********************************************************************
  const session = await relay.user.startsSession({ prompt: "Run the tests" });

  // ********************************************************************
  // ** THEN the permission request describes an execute call to run `npm test`
  // ********************************************************************
  const events = eventsStreamedByRelay(relay, session);
  const tool = { title: "Run npm test", kind: "execute", command: "npm test" };
  await expectPermissionRequestDescribed(events, tool);
});

test("a finished turn arrives as a normalised turn-ended update", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will reply and end its turn normally
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willReply("All done");

  // ********************************************************************
  // ** WHEN the user starts a session and the agent finishes its turn
  // ********************************************************************
  const session = await relay.user.startsSession({ prompt: "Do the thing" });
  await relay.user.waitsForTheAgentToFinish(session);

  // ********************************************************************
  // ** THEN the relay delivered a turn-ended update with stop reason end_turn
  // ********************************************************************
  await expectTurnEndedAsUpdate(eventsStreamedByRelay(relay, session), "end_turn");
});

test("an update kind the relay does not interpret arrives as `other` with its name", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will report compacting its context
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willCompactContext();

  // ********************************************************************
  // ** WHEN the user starts a session and the agent finishes its turn
  // ********************************************************************
  const session = await relay.user.startsSession({ prompt: "Tidy up" });
  await relay.user.waitsForTheAgentToFinish(session);

  // ********************************************************************
  // ** THEN the relay delivered an `other` update named compaction_update
  // ********************************************************************
  await expectUninterpretedUpdate(eventsStreamedByRelay(relay, session), "compaction_update");
});

test("the raw ACP message is kept unchanged next to its normalised updates", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will reply "Raw and normalised"
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willReply("Raw and normalised");

  // ********************************************************************
  // ** WHEN the user starts a session and the agent finishes its turn
  // ********************************************************************
  const session = await relay.user.startsSession({ prompt: "Say it" });
  await relay.user.waitsForTheAgentToFinish(session);

  // ********************************************************************
  // ** THEN the event holds the exact message the agent sent, with its update beside it
  // ********************************************************************
  const events = eventsStreamedByRelay(relay, session);
  await expectRawReplyUnchanged(events, { text: "Raw and normalised" });
  // AND no ACP event went out without its updates
  await expectRawMessagesKeptNextToUpdates(events);
});

test("usage for a finished turn is computed from the normalised updates", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will report 1200 input tokens, a cost of $0.02 and its model
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  const tokens = {
    inputTokens: 1200,
    outputTokens: 340,
    cachedReadTokens: 0,
    cachedWriteTokens: 0,
  };
  relay.mockAgent.willReportUsage({ model: "claude-sonnet-4-5", costUsd: 0.02, ...tokens });

  // ********************************************************************
  // ** WHEN the user starts a session and the agent finishes its turn
  // ********************************************************************
  const session = await relay.user.startsSession({ prompt: "Add rate limiting" });
  await relay.user.waitsForTheAgentToFinish(session);

  // ********************************************************************
  // ** THEN the relay reports one usage row with those tokens, that cost and that model
  // ********************************************************************
  const usage = { session, inputTokens: 1200, costUsd: 0.02, model: "claude-sonnet-4-5" };
  await expectUsageFromUpdates(relay, usage);
});
