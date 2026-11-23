import { expectSessionWaitingForReply } from "../expect/app-expectations.ts";
import type { Session } from "../setup/app.ts";
import { expectSessionRowToShowApproveBadge } from "./browser-expectations.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

/** The user approves the agent's file write from the session's row, and the turn finishes. */
export async function approvesTheWriteAndWaitsForTheAgent(
  app: AppInBrowser,
  session: Session,
): Promise<void> {
  await expectSessionRowToShowApproveBadge(app, session.title);
  await app.page.approvesFromTheRow(session.title);
  await expectSessionWaitingForReply(app, session);
}

/**
 * Starts a session whose scripted agent writes a file and finishes, then opens it in the browser
 * and previews `path` from the Changes list.
 */
export async function opensPreviewOfFileTheAgentWrote(
  app: AppInBrowser,
  path: string,
): Promise<Session> {
  const session = await app.user.startsSession({ prompt: "Write the page" });
  await approvesTheWriteAndWaitsForTheAgent(app, session);
  await app.page.opensSession(session.title);
  await app.page.previewsFileFromTheList(path);
  return session;
}
