import { afterEach, test } from "bun:test";
import {
  expectAgentNotStarted,
  expectExactlyTheLaterEvents,
  expectPendingRequestToRunCommand,
  expectSessionWaitingForApproval,
  expectSessionWaitingForReply,
  expectSessionWaitingForSetupFix,
} from "../support/expect/session-expectations.ts";
import { startRelayWithSessionWaitingToRunNpmTest } from "../support/setup/relay-sessions.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

test("a session that asks to run a command is shown as waiting on you", async () => {
  // ********************************************************************
  // ** GIVEN the relay is running with one local repo
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  // AND the agent will ask permission to run `npm test` on its first turn
  relay.mockAgent.willAskToRunCommand("npm test");

  // ********************************************************************
  // ** WHEN the user starts a session asking to add rate limiting
  // ********************************************************************
  const session = await relay.user.startsSession({ prompt: "Add rate limiting" });

  // ********************************************************************
  // ** THEN the session list flags the session as waiting for approval
  // ********************************************************************
  await expectSessionWaitingForApproval(relay, session);
  // AND the pending request names the `npm test` command
  await expectPendingRequestToRunCommand(relay, session, "npm test");
});

test("after the user allows the command the agent finishes and the session waits for a reply", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will ask to run `npm test`, then reply "Tests pass"
  // ********************************************************************
  // AND the user has started a session that is waiting for approval
  const { relay, session } = await startRelayWithSessionWaitingToRunNpmTest({
    thenReplies: "Tests pass",
  });

  // ********************************************************************
  // ** WHEN the user allows the command
  // ********************************************************************
  await relay.user.allowsTheCommand(session);

  // ********************************************************************
  // ** THEN the agent finishes its turn and the session waits for a reply
  // ********************************************************************
  await expectSessionWaitingForReply(relay, session);
});

test("the relay keeps a session's events while the app is closed", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will reply "Tests pass"
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willReply("Tests pass");
  // AND the user has started a session, and the app only saw its first event
  const session = await relay.user.startsSession({ prompt: "Run the tests" });
  const seenSoFar = 1;

  // ********************************************************************
  // ** WHEN the user closes the app and opens it again later
  // ********************************************************************
  await relay.closesTheApp();
  relay.opensTheApp();
  await relay.followsSessionAfter(session, seenSoFar);

  // ********************************************************************
  // ** THEN the app receives exactly the events recorded after the first one
  // ********************************************************************
  await expectExactlyTheLaterEvents(relay, { session, afterSeq: seenSoFar });
});

test("a session whose setup script fails waits on the user and its agent is not started", async () => {
  // ********************************************************************
  // ** GIVEN a repo whose setup script fails
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  await relay.repoSetupScriptIs("echo cannot install >&2; exit 3");

  // ********************************************************************
  // ** WHEN the user starts a session
  // ********************************************************************
  const session = await relay.user.startsSession({ prompt: "Add rate limiting" });

  // ********************************************************************
  // ** THEN the session waits for the user to fix the setup
  // ********************************************************************
  await expectSessionWaitingForSetupFix(relay, session);
  // AND the agent was never started
  expectAgentNotStarted(relay, session);
});
