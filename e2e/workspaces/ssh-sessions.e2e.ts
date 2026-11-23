import { afterEach, setDefaultTimeout, test } from "bun:test";
import {
  expectLiveStreamDeliveredAgentReply,
  expectSessionWaitingForReply,
} from "../support/expect/app-expectations.ts";
import {
  expectHostToHoldTheSession,
  expectListToHold,
  expectSessionOnThisMac,
  expectSessionOnWorkspace,
} from "../support/expect/ssh-session-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithSshHost } from "../support/setup/start-app-with-ssh-host.ts";

// Every ssh call is a real handshake, and the suite runs files side by side.
setDefaultTimeout(60_000);
afterEach(cleanUpAfterTest);

test("a session started on the ssh workspace runs its agent on the host and its events reach the app", async () => {
  // ********************************************************************
  // ** GIVEN an ssh workspace whose agent will answer "Hello from the host"
  // ********************************************************************
  const { app, host, user } = await startAppWithSshHost();
  const workspace = await user.addsTheHost();
  host.mockAgent.willReply("Hello from the host");

  // ********************************************************************
  // ** WHEN the user starts a session on that workspace
  // ********************************************************************
  const session = await user.startsSessionOn(workspace, { prompt: "Say hello" });

  // ********************************************************************
  // ** THEN the live stream delivers the agent's answer
  // ********************************************************************
  await expectLiveStreamDeliveredAgentReply(app, { session, text: "Hello from the host" });
  // AND the session waits for the user's reply
  await expectSessionWaitingForReply(app, session);
  // AND the host's own relay holds the session's log
  await expectHostToHoldTheSession(host, session);
});

test("sessions on this Mac and on the ssh host are listed together, each with its workspace", async () => {
  // ********************************************************************
  // ** GIVEN a finished session on this Mac and a finished session on the ssh host
  // ********************************************************************
  const { app, host, user } = await startAppWithSshHost();
  const workspace = await user.addsTheHost();
  app.mockAgent.willReply("Answer from this Mac");
  const here = await app.user.startsSession({ prompt: "Work on this Mac" });
  host.mockAgent.willReply("Answer from the host");
  const there = await user.startsSessionOn(workspace, { prompt: "Work on the host" });
  await expectSessionWaitingForReply(app, here);
  await expectSessionWaitingForReply(app, there);

  // ********************************************************************
  // ** WHEN the user opens the session list
  // ********************************************************************
  const listed = await app.sdk.sessions.list();

  // ********************************************************************
  // ** THEN each session is listed under the workspace it runs on
  // ********************************************************************
  await expectSessionOnThisMac(app, here);
  // AND the host's session under the ssh workspace
  await expectSessionOnWorkspace(app, { session: there, workspace });
  // AND both are in the one list
  expectListToHold(listed, [here, there]);
});
