import type { AppInBrowser } from "./start-app-in-browser.ts";

/** The New session dialog, filled in with the app's repository and the mock agent; only Create session is left. */
export async function aFilledInNewSessionDialog(app: AppInBrowser): Promise<void> {
  await app.mockAgent.writeScript();
  await app.page.opensNewSession();
  await app.page.choosesToAddARepository();
  await app.page.typesRepositoryFolder(app.repoPath);
  await app.page.addsTheRepository();
  await app.page.choosesAgent("Mock agent");
}

/** A page expression: the session list has a session, and the open session shows its message box. */
export const A_SESSION_IS_OPEN_WITH_ITS_MESSAGE_BOX =
  'document.querySelector("[data-session-item]") !== null && document.querySelector("textarea") !== null';
