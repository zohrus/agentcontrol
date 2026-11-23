import { expectSessionWaitingForReply } from "../expect/app-expectations.ts";
import type { Session } from "../setup/app.ts";
import { SHELL_RELAY_ENV } from "../setup/start-app-with-shell.ts";
import { type AppInBrowser, startAppInBrowser } from "./start-app-in-browser.ts";

/** The app open in a browser with a finished session selected, ready for its Terminal tab. */
export async function opensAFinishedSession(): Promise<{ app: AppInBrowser; session: Session }> {
  const app = await startAppInBrowser({ relayEnv: SHELL_RELAY_ENV });
  app.mockAgent.willReply("Done");
  const session = await app.user.startsSession({ prompt: "Add rate limiting" });
  await expectSessionWaitingForReply(app, session);
  await app.page.opensSession(session.title);
  return { app, session };
}
