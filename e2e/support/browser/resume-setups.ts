import { expectSessionWaitingForReply } from "../expect/app-expectations.ts";
import type { Session } from "../setup/app.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

/**
 * A session open in the browser whose agent replied "Tests pass" and waits for the user, and then
 * the relay stops and starts again, taking the agent with it.
 */
export async function opensSessionWhoseRelayThenRestarts(app: AppInBrowser): Promise<Session> {
  app.mockAgent.willReply("Tests pass");
  const session = await app.user.startsSession({ prompt: "Run the tests" });
  await expectSessionWaitingForReply(app, session);
  await app.page.opensSession(session.title);
  await app.theRelayStops();
  await app.theRelayStartsAgain();
  return session;
}
