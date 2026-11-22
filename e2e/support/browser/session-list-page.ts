import type { Locator, Page } from "./playwright.ts";

const rowsOf = (page: Page) => page.locator("[data-session-item]");

/** The row of the session with this title. */
const rowOf = (page: Page, title: string): Locator => rowsOf(page).filter({ hasText: title });

/** The session list on the left: rows, their badges and Approve / Deny, and the filters. */
export function sessionListPage(page: Page) {
  return {
    opensSession: (title: string) =>
      rowOf(page, title).getByRole("button", { name: title }).click(),
    approvesFromTheRow: (title: string) =>
      rowOf(page, title)
        .getByRole("button", { name: /^Approve/ })
        .click(),
    showsArchivedSessions: () => page.getByRole("button", { name: "Archived" }).click(),
    /** The text of the session's row, or undefined when the list has no such row. */
    rowTextOf: async (title: string): Promise<string | undefined> => {
      const row = rowOf(page, title);
      return (await row.count()) === 0 ? undefined : row.innerText();
    },
    /** How many Approve buttons the session's row offers. */
    approveButtonsOf: (title: string) =>
      rowOf(page, title)
        .getByRole("button", { name: /^Approve/ })
        .count(),
  };
}
