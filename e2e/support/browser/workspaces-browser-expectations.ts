import { pageEventually, quote } from "./browser-expectations.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

/** The workspace menu says this about the workspace (its connection, its reason). */
export function expectWorkspaceRowToSay(
  app: AppInBrowser,
  call: { workspace: string; text: string },
): Promise<void> {
  const expectation = `expected the menu to say ${quote(call.text)} about "${call.workspace}"`;
  return pageEventually(expectation, async () => {
    const shown = await app.page.workspaceRowText(call.workspace);
    return shown.includes(call.text) ? undefined : `the row reads ${quote(shown)}`;
  });
}

/** The workspace menu has no row for this workspace. */
export function expectWorkspaceNotToBeListed(app: AppInBrowser, workspace: string): Promise<void> {
  return pageEventually(`expected the menu not to list "${workspace}"`, async () => {
    const shown = await app.page.workspaceRowText(workspace);
    return shown === "" ? undefined : `the row reads ${quote(shown)}`;
  });
}

/** The session list shows this under the workspace's name. */
export function expectWorkspaceGroupToShow(
  app: AppInBrowser,
  call: { workspace: string; texts: string[] },
): Promise<void> {
  const expectation = `expected the list to show ${call.texts.map(quote).join(", ")} under "${call.workspace}"`;
  return pageEventually(expectation, async () => {
    const shown = await app.page.groupText(call.workspace);
    const missing = call.texts.filter((text) => !shown.includes(text));
    return missing.length === 0 ? undefined : `the group reads ${quote(shown)}`;
  });
}

/** The question that comes before restarting or removing says this. */
export function expectConfirmationToSay(
  app: AppInBrowser,
  call: { title: string; text: string },
): Promise<void> {
  return pageEventually(`expected "${call.title}" to say ${quote(call.text)}`, async () => {
    const shown = await app.page.confirmationText(call.title);
    return shown.includes(call.text) ? undefined : `it reads ${quote(shown)}`;
  });
}
