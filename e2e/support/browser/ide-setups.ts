import { expectSessionWaitingForReply } from "../expect/app-expectations.ts";
import type { Session } from "../setup/app.ts";
import { FAKE_CODE_SERVER_ENV, NO_CODE_SERVER_ENV } from "../setup/ide-setups.ts";
import { type AppInBrowser, startAppInBrowser } from "./start-app-in-browser.ts";

async function opensAFinishedSessionWith(relayEnv: Record<string, string>) {
  const app = await startAppInBrowser({ relayEnv });
  const session: Session = await app.user.startsSession({ prompt: "Add rate limiting" });
  await expectSessionWaitingForReply(app, session);
  await app.page.opensSession(session.title);
  return { app, session };
}

/** The app open in a browser with a finished session selected, on a workspace with code-server. */
export function opensAFinishedSessionWithCodeServer(): Promise<{
  app: AppInBrowser;
  session: Session;
}> {
  return opensAFinishedSessionWith(FAKE_CODE_SERVER_ENV);
}

/** The same, on a workspace where code-server is not installed. */
export function opensAFinishedSessionWithoutCodeServer(): Promise<{
  app: AppInBrowser;
  session: Session;
}> {
  return opensAFinishedSessionWith(NO_CODE_SERVER_ENV);
}
