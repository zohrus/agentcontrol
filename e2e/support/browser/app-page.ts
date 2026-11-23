import { analyticsPage } from "./analytics-page.ts";
import { changesPage } from "./changes-page.ts";
import { configEditorPage } from "./config-editor-page.ts";
import { configPage } from "./config-page.ts";
import { dialogsPage } from "./dialogs-page.ts";
import { previewContent, previewPage } from "./preview-page.ts";
import { terminalPage } from "./terminal-page.ts";
import { modifyPage } from "./modify-page.ts";
import type { Page } from "./playwright.ts";
import { sessionListPage } from "./session-list-page.ts";
import { sessionPage } from "./session-page.ts";
import { shellPage } from "./shell-page.ts";
import { workspacePage } from "./workspace-page.ts";
import { workspacesPage } from "./workspaces-page.ts";
import { firstTextOf } from "./read-text.ts";

/** What a person does and sees in the default UI, in the words of the UI. */
export function appPageOf(page: Page) {
  return {
    ...analyticsPage(page),
    ...sessionListPage(page),
    ...sessionPage(page),
    ...changesPage(page),
    ...dialogsPage(page),
    ...workspacePage(page),
    ...workspacesPage(page),
    ...configPage(page),
    ...configEditorPage(page),
    ...shellPage(page),
    ...previewPage(page),
    ...previewContent(page),
    ...terminalPage(page),
    ...modifyPage(page),
    /** The connection indicator in the status bar: "Connected", "Reconnecting…" or "Offline". */
    connectionText: async (): Promise<string> => {
      const status = page
        .getByRole("status")
        .filter({ hasText: /^(Connected|Reconnecting|Offline)/ });
      return firstTextOf(status);
    },
    /** The part of the page address after `#`, which names the open session. */
    addressHash: () => page.evaluate<string>("window.location.hash"),
    bodyText: () => page.locator("body").innerText(),
    takesScreenshot: (path: string) => page.screenshot({ path }),
  };
}

export type AppPage = ReturnType<typeof appPageOf>;
