import { expectSessionWaitingForApproval } from "../expect/app-expectations.ts";
import type { Session } from "../setup/app.ts";
import { expectEditorToShow, expectStreamToShow } from "./browser-expectations.ts";
import { opensSessionWithUncommittedEdit } from "./open-session-setups.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

/** A session open in the browser whose agent answered "First answer" and will answer "Second answer" next. */
export async function opensSessionThatAnswersTwice(app: AppInBrowser): Promise<Session> {
  app.mockAgent.willReply("First answer");
  app.mockAgent.onNextPrompt();
  app.mockAgent.willReply("Second answer");
  const session = await app.user.startsSession({ prompt: "Say hello" });
  await app.page.opensSession(session.title);
  await expectStreamToShow(app, "First answer");
  return session;
}

/** A session whose agent edited README.md, finished and left it uncommitted, with README.md open in the editor. */
export async function opensReadmeInTheEditor(app: AppInBrowser): Promise<Session> {
  const session = await opensSessionWithUncommittedEdit(app, "Reword the readme");
  await app.page.opensEditorTab();
  await app.page.opensFileInEditor("README.md");
  await expectEditorToShow(app, "// after");
  return session;
}

/** A session open in the browser, waiting for approval to run `npm test`. */
export async function opensSessionWaitingToRunNpmTest(app: AppInBrowser): Promise<Session> {
  app.mockAgent.willAskToRunCommand("npm test");
  const session = await app.user.startsSession({ prompt: "Add rate limiting" });
  await expectSessionWaitingForApproval(app, session);
  await app.page.opensSession(session.title);
  return session;
}

/** A session whose agent edited README.md and created NOTES.md, open in the browser. */
export async function opensSessionWithEditedAndNewFile(app: AppInBrowser): Promise<Session> {
  app.mockAgent.willEditFile("README.md");
  app.mockAgent.willEditFile("NOTES.md");
  return opensSessionWithUncommittedEdit(app, "Write some notes");
}
