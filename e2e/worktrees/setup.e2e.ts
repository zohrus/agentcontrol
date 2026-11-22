import { afterEach, test } from "bun:test";
import { expectFileToRead } from "../support/expect/file-expectations.ts";
import {
  expectDifferentPortBlocks,
  expectSetupOutputBeforeAgentStarts,
} from "../support/expect/setup-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

test("a new worktree receives the repo's .env file", async () => {
  // ********************************************************************
  // ** GIVEN a repo with an ignored .env file containing SECRET=1
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();

  // ********************************************************************
  // ** WHEN the user starts a session
  // ********************************************************************
  const session = await relay.user.startsSession({ prompt: "Add rate limiting" });

  // ********************************************************************
  // ** THEN the session's worktree has the same .env file
  // ********************************************************************
  await expectFileToRead(relay, { session, path: ".env", ref: "working", content: "SECRET=1\n" });
});

test("the setup script's output appears in the session's events before the agent starts", async () => {
  // ********************************************************************
  // ** GIVEN a repo whose setup script prints "installing dependencies"
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  await relay.repoSetupScriptIs("echo installing dependencies");

  // ********************************************************************
  // ** WHEN the user starts a session
  // ********************************************************************
  const session = await relay.user.startsSession({ prompt: "Add rate limiting" });

  // ********************************************************************
  // ** THEN the setup output is recorded before the agent starts
  // ********************************************************************
  await expectSetupOutputBeforeAgentStarts(relay, { session, text: "installing dependencies" });
});

test("two sessions on the same repo get different port blocks", async () => {
  // ********************************************************************
  // ** GIVEN a repo whose setup script prints PORT and AGENTCONTROL_PORT_BASE
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  await relay.repoSetupScriptIs('echo "PORT=$PORT BASE=$AGENTCONTROL_PORT_BASE"');

  // ********************************************************************
  // ** WHEN the user starts two sessions
  // ********************************************************************
  const first = await relay.user.startsSession({ prompt: "Add rate limiting" });
  const second = await relay.user.startsSession({ prompt: "Add caching" });

  // ********************************************************************
  // ** THEN each session's setup saw a different port block
  // ********************************************************************
  await expectDifferentPortBlocks(relay, { first, second });
});
