import { expectSessionListed } from "./browser-expectations.ts";
import { expectSessionWaitingForReply } from "../expect/app-expectations.ts";
import type { Session } from "../setup/app.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

/** A session whose agent only replied, and is waiting for the user: listed, not open yet. */
export async function startsSessionThatOnlyReplied(
  app: AppInBrowser,
  prompt: string,
): Promise<Session> {
  app.mockAgent.willReply("Nothing to change");
  return app.user.startsSession({ prompt });
}

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

/** A session whose agent edited README.md and replied "Reworded", while the page gets its changes in an unreadable shape. */
export async function startsSessionWithUnreadableChanges(app: AppInBrowser): Promise<Session> {
  await app.page.getsAnUnexpectedAnswerFrom("/diff");
  app.mockAgent.willEditFile("README.md");
  app.mockAgent.willReply("Reworded");
  const session = await app.user.startsSession({ prompt: "Reword the readme" });
  await expectSessionListed(app, session.title);
  return session;
}
