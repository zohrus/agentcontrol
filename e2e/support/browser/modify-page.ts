import type { Page } from "./playwright.ts";
import { textOf } from "./read-text.ts";

const panelOf = (page: Page) => page.getByRole("dialog", { name: "Modify this UI" });
const buttonOf = (page: Page, name: string) =>
  panelOf(page).getByRole("button", { name, exact: true });
const tabOf = (page: Page, name: RegExp) => panelOf(page).getByRole("tab", { name });
const restoreButtonOf = (page: Page, message: string) =>
  panelOf(page).getByRole("button", { name: `Restore “${message}”` });

/** Opening the panel and asking for a change, Keep, Undo and Discard. */
function changeControls(page: Page) {
  return {
    /** Presses "Modify this UI" in the top bar. */
    opensTheModifyPanel: () => page.getByRole("button", { name: /^Modify this UI/ }).click(),
    /** Presses the keyboard shortcut for the panel (⌘. on a Mac, Ctrl+. here). */
    pressesTheModifyShortcut: () => page.keyboard.press("Control+."),
    /** Types the request into the panel's prompt box and sends it. */
    asksToModifyTheUi: async (request: string): Promise<void> => {
      await panelOf(page).locator("textarea").fill(request);
      await buttonOf(page, "Send").click();
    },
    keepsTheChange: () => buttonOf(page, "Keep").click(),
    undoesTheChange: () => buttonOf(page, "Undo").click(),
    undoesTheLastKeptChange: () => buttonOf(page, "Undo last change").click(),
    discardsTheChange: () => buttonOf(page, "Discard").click(),
    /** Presses "Update" on the banner that offers the new default UI. */
    appliesTheDefaultUiUpdate: () => buttonOf(page, "Update").click(),
  };
}

/** The version history, the recovery link and reloading the page. */
function historyControls(page: Page) {
  return {
    opensTheVersionHistory: () => tabOf(page, /^History/).click(),
    opensTheChat: () => tabOf(page, /^Chat$/).click(),
    /** Presses Restore next to the version with this message; the panel then asks to confirm. */
    startsRestoringTheVersion: (message: string) => restoreButtonOf(page, message).click(),
    confirmsTheRestore: () => buttonOf(page, "Yes, restore").click(),
    reloadsThePage: () => page.reload(),
    followsTheRecoveryLink: () =>
      panelOf(page)
        .getByRole("link", { name: /open the recovery page/ })
        .click(),
  };
}

/** What the panel and the page show right now. */
function modifyReads(page: Page) {
  return {
    /** The address of the page the browser is on, for example "http://127.0.0.1:4747/_safe". */
    pageAddress: (): string => page.url(),
    /** Everything the open panel shows, or "" when it is closed. */
    modifyPanelText: async (): Promise<string> => {
      return textOf(panelOf(page));
    },
    /** The text of the "Changed files" list in the panel, or "" when it is not shown. */
    changedFilesText: async (): Promise<string> => {
      return textOf(panelOf(page).getByRole("list", { name: "Changed files" }));
    },
  };
}

/** The "Modify this UI" panel: asking for a change, Keep, Undo, Discard, the version history. */
export function modifyPage(page: Page) {
  return { ...changeControls(page), ...historyControls(page), ...modifyReads(page) };
}
