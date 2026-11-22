import { expectSessionWaitingForReply } from "../expect/app-expectations.ts";
import type { Session } from "../setup/app.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

/** A session whose agent edited README.md, left it uncommitted and finished; open in the browser. */
export async function opensSessionWithUncommittedEdit(
  app: AppInBrowser,
  prompt: string,
): Promise<Session> {
  app.mockAgent.willEditFile("README.md");
  const session = await app.user.startsSession({ prompt });
  await expectSessionWaitingForReply(app, session);
  await app.page.opensSession(session.title);
  return session;
}
