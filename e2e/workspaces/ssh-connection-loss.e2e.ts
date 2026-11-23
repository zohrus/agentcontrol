import { afterEach, test } from "bun:test";
import {
  expectHistoryContinuesWithoutGaps,
  expectLiveStreamDeliveredAgentReply,
  expectSessionWaitingForReply,
} from "../support/expect/app-expectations.ts";
import {
  expectWorkspaceListedAs,
  expectWorkspaceToBecome,
} from "../support/expect/ssh-expectations.ts";
import { expectHostToHaveFinishedTheTurn } from "../support/expect/ssh-session-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithSshHost } from "../support/setup/start-app-with-ssh-host.ts";

afterEach(cleanUpAfterTest);

test("when the ssh connection is cut mid-turn, no event is lost and none is repeated", async () => {
  // ********************************************************************
  // ** GIVEN a session on the ssh workspace whose agent said "Part one" and now waits
  // ********************************************************************
  const { app, host, user } = await startAppWithSshHost();
  const workspace = await user.addsTheHost();
  host.agentWillPauseBetween("Part one", "Part two");
  const session = await user.startsSessionOn(workspace, { prompt: "Work in two parts" });
  await expectLiveStreamDeliveredAgentReply(app, { session, text: "Part one" });
  const historyBefore = await app.user.readsHistoryOf(session);

  // ********************************************************************
  // ** WHEN the connection is cut and the agent then goes on
  // ********************************************************************
  host.network.drops();
  await expectWorkspaceToBecome(app, { workspace, state: "reconnecting" });
  await host.agentContinues();

  // ********************************************************************
  // ** THEN the history continues after what the app had, with no gap and no repeat
  // ********************************************************************
  await expectHistoryContinuesWithoutGaps(app, { session, after: historyBefore });
  // AND the live stream delivered the second part
  await expectLiveStreamDeliveredAgentReply(app, { session, text: "Part two" });
});

test("the host keeps the turn running while the app is offline, and the result arrives when it is back", async () => {
  // ********************************************************************
  // ** GIVEN a session on the ssh workspace whose agent waits before it answers
  // ********************************************************************
  const { app, host, user } = await startAppWithSshHost();
  const workspace = await user.addsTheHost();
  host.mockAgent.willWaitForFile(host.releaseFile);
  host.mockAgent.willReply("Finished while you were away");
  const session = await user.startsSessionOn(workspace, { prompt: "Take your time" });

  // ********************************************************************
  // ** WHEN the network goes down and the agent finishes in the meantime
  // ********************************************************************
  host.network.goesDown();
  await expectWorkspaceListedAs(app, { workspace, state: "offline" });
  await host.agentContinues();
  await expectHostToHaveFinishedTheTurn(host, session);

  // ********************************************************************
  // ** THEN once the network is back the app has the answer and the session waits for a reply
  // ********************************************************************
  host.network.comesBack();
  await expectLiveStreamDeliveredAgentReply(app, { session, text: "Finished while you were away" });
  await expectSessionWaitingForReply(app, session);
});
