import { afterEach, test } from "bun:test";
import {
  expectModeChangeAsUpdate,
  expectNoticeAsUpdate,
} from "../support/expect/agent-report-expectations.ts";
import { eventsStreamedByRelay } from "../support/expect/update-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { agentWillSwitchModeShowNoticeAndReportConnectionError } from "../support/setup/reported-updates.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

test("a mode switch, a notice and a connection error the agent reports arrive as normalised updates", async () => {
  // ********************************************************************
  // ** GIVEN an agent that switches to plan mode, shows a warning and reports a failing connection
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  agentWillSwitchModeShowNoticeAndReportConnectionError(relay.mockAgent);

  // ********************************************************************
  // ** WHEN the user starts a session and the agent finishes its turn
  // ********************************************************************
  const session = await relay.user.startsSession({ prompt: "Plan the change" });
  await relay.user.waitsForTheAgentToFinish(session);

  // ********************************************************************
  // ** THEN the relay delivered the mode switch as a mode-changed update
  // ********************************************************************
  const source = eventsStreamedByRelay(relay, session);
  await expectModeChangeAsUpdate(source, "plan");
  // AND the warning as a notice with its description
  await expectNoticeAsUpdate(source, {
    severity: "warning",
    text: "Rate limited: Retrying in a minute",
  });
  // AND the connection error as a warning notice, since the agent will retry
  await expectNoticeAsUpdate(source, { severity: "warning", text: "Connection lost (timeout)" });
});
