import { eventually } from "../setup/eventually.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

const BROWSER_WAIT_MS = 30_000;

const quote = (text: string): string => JSON.stringify(text);

/** The open Modify panel shows this text. */
export function expectModifyPanelToShow(app: AppInBrowser, text: string): Promise<void> {
  return eventually(
    `expected the Modify panel to show ${quote(text)}`,
    async () => {
      const shown = await app.page.modifyPanelText();
      return shown.includes(text) ? undefined : `it shows ${quote(shown)}`;
    },
    BROWSER_WAIT_MS,
  );
}

/** The open Modify panel does not show this text (any more). */
export function expectModifyPanelNotToShow(app: AppInBrowser, text: string): Promise<void> {
  return eventually(
    `expected the Modify panel not to show ${quote(text)}`,
    async () => {
      const shown = await app.page.modifyPanelText();
      return shown.includes(text) ? "it still does" : undefined;
    },
    BROWSER_WAIT_MS,
  );
}

/** The panel lists this file as changed by the change that waits for Keep. */
export function expectModifyPanelToListChangedFile(app: AppInBrowser, path: string): Promise<void> {
  return eventually(
    `expected the Modify panel to list ${path} as a changed file`,
    async () => {
      const listed = await app.page.changedFilesText();
      return listed.includes(path) ? undefined : `the list shows ${quote(listed)}`;
    },
    BROWSER_WAIT_MS,
  );
}

/** The page is on this path of the app, for example "/_safe". */
export function expectBrowserOnPath(app: AppInBrowser, path: string): Promise<void> {
  return eventually(
    `expected the browser to be on ${path}`,
    () => {
      const { pathname } = new URL(app.page.pageAddress());
      return Promise.resolve(pathname === path ? undefined : `it is on ${pathname}`);
    },
    BROWSER_WAIT_MS,
  );
}
