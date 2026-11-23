import { changesPage } from "./changes-page.ts";
import { dialogsPage } from "./dialogs-page.ts";
import { modifyPage } from "./modify-page.ts";
import type { Page } from "./playwright.ts";
import { sessionListPage } from "./session-list-page.ts";
import { sessionPage } from "./session-page.ts";

/** What a person does and sees in the default UI, in the words of the UI. */
export function appPageOf(page: Page) {
  return {
    ...sessionListPage(page),
    ...sessionPage(page),
    ...changesPage(page),
    ...dialogsPage(page),
    ...modifyPage(page),
    /** The connection indicator in the status bar: "Connected", "Reconnecting…" or "Offline". */
    connectionText: async (): Promise<string> => {
      const status = page
        .getByRole("status")
        .filter({ hasText: /^(Connected|Reconnecting|Offline)/ });
      return (await status.count()) === 0 ? "" : status.first().innerText();
    },
    /** The part of the page address after `#`, which names the open session. */
    addressHash: () => page.evaluate<string>("window.location.hash"),
    bodyText: () => page.locator("body").innerText(),
    takesScreenshot: (path: string) => page.screenshot({ path }),
  };
}

export type AppPage = ReturnType<typeof appPageOf>;
