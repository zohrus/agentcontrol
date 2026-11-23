import { afterEach, test } from "bun:test";
import {
  expectLiveStreamToReportTheLocalWorkspaceNotConnected,
  expectRefusalToBeRelayUnavailable,
  expectRefusalToNameTheWorkspace,
  expectTheRelayToBeHoldingARequest,
} from "../support/expect/relay-gone-expectations.ts";
import { attemptApi } from "../support/setup/app-attempt.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { aRelayThatLeavesTheAgentListUnanswered } from "../support/setup/silent-relay.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("a request made after the app noticed the relay is gone is refused as unavailable, naming the workspace", async () => {
  // ********************************************************************
  // ** GIVEN a running app whose relay has stopped, and the app has said so
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  await app.theRelayStops();
  await expectLiveStreamToReportTheLocalWorkspaceNotConnected(app);

  // ********************************************************************
  // ** WHEN the user asks for something only the relay can answer
  // ********************************************************************
  const refused = await app.user.triesToListTheAgents();

  // ********************************************************************
  // ** THEN the app refuses with the plain "relay unavailable" answer
  // ********************************************************************
  expectRefusalToBeRelayUnavailable(refused);
  // AND the refusal names the local workspace
  expectRefusalToNameTheWorkspace(refused, "local");
});

test("a request still waiting when the relay stops is refused as unavailable", async () => {
  // ********************************************************************
  // ** GIVEN a request the relay has taken and not yet answered
  // ********************************************************************
  const relay = aRelayThatLeavesTheAgentListUnanswered();
  const app = await startAppWithLocalWorkspace({ relayWire: relay.wire });
  const waiting = attemptApi(app.sdk.agents.list());
  await expectTheRelayToBeHoldingARequest(relay);

  // ********************************************************************
  // ** WHEN the relay stops
  // ********************************************************************
  await app.theRelayStops();

  // ********************************************************************
  // ** THEN the waiting request is refused with the plain "relay unavailable" answer
  // ********************************************************************
  expectRefusalToBeRelayUnavailable(await waiting);
});
