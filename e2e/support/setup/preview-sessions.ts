import type { Session } from "./app.ts";
import { expectSessionWaitingForReply } from "../expect/app-expectations.ts";
import { GREETING_PAGE } from "./preview-pages.ts";
import type { WorktreeFiles } from "./preview-user.ts";
import { type RunningApp, type StartOptions, startAppWithLocalWorkspace } from "./start-app.ts";

/** One session that has finished its turn, so its worktree exists and is quiet. */
export async function startsSessionThatFinished(app: RunningApp, prompt: string): Promise<Session> {
  const session = await app.user.startsSession({ prompt });
  await expectSessionWaitingForReply(app, session);
  return session;
}

/** An app with one finished session whose worktree already holds these files. */
export async function startAppWithSessionHolding(
  files: WorktreeFiles,
  options: StartOptions = {},
): Promise<{ app: RunningApp; session: Session }> {
  const app = await startAppWithLocalWorkspace(options);
  const session = await startsSessionThatFinished(app, "Make a page");
  await app.user.writesFilesInTheWorktree(session, files);
  return { app, session };
}

/** An app whose finished session holds page.html (a page with a script), and the page's address. */
export async function startAppPreviewingGreetingPage(options: StartOptions = {}) {
  const files = { "page.html": GREETING_PAGE };
  const { app, session } = await startAppWithSessionHolding(files, options);
  const address = await app.user.asksForPreviewAddressOf(session, "page.html");
  return { app, session, address };
}
