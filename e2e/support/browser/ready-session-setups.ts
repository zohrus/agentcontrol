import { basename } from "node:path";
import { RelayName } from "@agentcontrol/protocol";
import { expectSessionToBe } from "../expect/ready-session-expectations.ts";
import type { Session } from "../setup/app.ts";
import { aRelayThatIsSlowToAnswer } from "../setup/slow-relay.ts";
import { expectSessionListed, expectSessionRowToShowApproveBadge } from "./browser-expectations.ts";
import { type AppInBrowser, startAppInBrowser } from "./start-app-in-browser.ts";

/** A session without a prompt, ready for its first message, and open in the browser. */
export async function aReadySessionOpenInTheBrowser(app: AppInBrowser): Promise<Session> {
  await app.mockAgent.writeScript();
  const id = await app.sdk.sessions.start({
    agent: "mock",
    repoPath: app.repoPath,
    baseBranch: "main",
  });
  const session = { id, title: `${basename(app.repoPath)} – new session` };
  await expectSessionToBe(app, { session, status: "ready" });
  await expectSessionListed(app, session.title);
  await app.page.opensSession(session.title);
  return session;
}

/** A ready session open in a browser, whose agent will reply, behind a relay slow to take messages. */
export async function aReadySessionBehindARelaySlowToTakeMessages(reply: string) {
  const relay = aRelayThatIsSlowToAnswer(RelayName.prompt);
  const app = await startAppInBrowser({ relayWire: relay.wire });
  app.mockAgent.willReply(reply);
  await aReadySessionOpenInTheBrowser(app);
  return { app, relay };
}

/**
 * A session whose agent asks to run `npm test` and then replies, open in a browser, behind a relay
 * slow to take the answer to the request.
 */
export async function aSessionAskingPermissionBehindARelaySlowToAnswer(reply: string) {
  const relay = aRelayThatIsSlowToAnswer(RelayName.permissionRespond);
  const app = await startAppInBrowser({ relayWire: relay.wire });
  app.mockAgent.willAskToRunCommand("npm test");
  app.mockAgent.willReply(reply);
  const session = await app.user.startsSession({ prompt: "Add rate limiting" });
  await expectSessionRowToShowApproveBadge(app, session.title);
  await app.page.opensSession(session.title);
  return { app, relay };
}
