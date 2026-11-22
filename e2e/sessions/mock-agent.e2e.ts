import { afterEach, test } from "bun:test";
import {
  expectAgentNotToHaveReplied,
  expectAgentReply,
  expectAgentToAskPermissionToRun,
  expectAgentToEditFile,
  expectTurnToEndWith,
} from "../support/expect/agent-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { createMockAgent } from "../support/setup/mock-agent-script.ts";
import { startMockAgentSession } from "../support/setup/start-mock-agent-session.ts";

afterEach(cleanUpAfterTest);

test("the mock agent asks permission before running a command", async () => {
  // ********************************************************************
  // ** GIVEN a conversation with an agent that will ask to run `npm test`
  // ********************************************************************
  const mockAgent = await createMockAgent();
  mockAgent.willAskToRunCommand("npm test");
  const conversation = await startMockAgentSession(mockAgent);

  // ********************************************************************
  // ** WHEN the user asks it to run the tests
  // ********************************************************************
  void conversation.userSends("Run the tests");

  // ********************************************************************
  // ** THEN the agent asks permission to run `npm test`
  // ********************************************************************
  await expectAgentToAskPermissionToRun(conversation, "npm test");
});

test("the mock agent finishes its turn after the user allows the command", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will ask to run `npm test`, then reply "Tests pass"
  // ********************************************************************
  const mockAgent = await createMockAgent();
  mockAgent.willAskToRunCommand("npm test");
  mockAgent.willReply("Tests pass");
  const conversation = await startMockAgentSession(mockAgent);
  // AND the user has asked it to run the tests
  const turn = conversation.userSends("Run the tests");
  await expectAgentToAskPermissionToRun(conversation, "npm test");

  // ********************************************************************
  // ** WHEN the user allows the command
  // ********************************************************************
  conversation.userAllowsTheCommand();

  // ********************************************************************
  // ** THEN the agent replies "Tests pass" and ends its turn
  // ********************************************************************
  await expectAgentReply(conversation, "Tests pass");
  expectTurnToEndWith(await turn, "end_turn");
});

test("the mock agent stops without replying when the user rejects the command", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will ask to run `rm -rf build`, then reply "Cleaned"
  // ********************************************************************
  const mockAgent = await createMockAgent();
  mockAgent.willAskToRunCommand("rm -rf build");
  mockAgent.willReply("Cleaned");
  const conversation = await startMockAgentSession(mockAgent);
  const turn = conversation.userSends("Clean the build folder");
  await expectAgentToAskPermissionToRun(conversation, "rm -rf build");

  // ********************************************************************
  // ** WHEN the user rejects the command
  // ********************************************************************
  conversation.userRejectsTheCommand();

  // ********************************************************************
  // ** THEN the agent ends its turn without the "Cleaned" reply
  // ********************************************************************
  expectTurnToEndWith(await turn, "end_turn");
  expectAgentNotToHaveReplied(conversation, "Cleaned");
});

test("the mock agent edits a file and tells the user", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will edit src/server.ts and reply "Done"
  // ********************************************************************
  const mockAgent = await createMockAgent();
  mockAgent.willEditFile("src/server.ts");
  mockAgent.willReply("Done");
  const conversation = await startMockAgentSession(mockAgent);

  // ********************************************************************
  // ** WHEN the user asks for a change
  // ********************************************************************
  await conversation.userSends("Add rate limiting");

  // ********************************************************************
  // ** THEN the agent edited src/server.ts and replied "Done"
  // ********************************************************************
  await expectAgentToEditFile(conversation, "src/server.ts");
  await expectAgentReply(conversation, "Done");
});
