import { eventually } from "../setup/eventually.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

const BROWSER_WAIT_MS = 30_000;

/** The session list in the open tab has a row for this session. */
export function expectSessionListToShow(app: AppInBrowser, title: string): Promise<void> {
  return eventually(
    `expected the session list in the tab to show "${title}"`,
    async () =>
      (await app.page.rowTextOf(title)) === undefined ? "the list has no such row" : undefined,
    BROWSER_WAIT_MS,
  );
}
