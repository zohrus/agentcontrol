import type { Locator, Page } from "./playwright.ts";
import { textsOf, textOf } from "./read-text.ts";

const rowsOf = (page: Page) => page.locator("[data-session-item]");

/** The row of the session with this title. */
const rowOf = (page: Page, title: string): Locator => rowsOf(page).filter({ hasText: title });

/** The title of a row: the first line of its text. */
const titleOfRow = async (row: Locator): Promise<string> =>
  ((await row.innerText()).split("\n")[0] ?? "").trim();

function filters(page: Page) {
  return {
    showsArchivedSessions: () => page.getByRole("button", { name: "Archived" }).click(),
    showsTheInbox: () => page.getByRole("button", { name: /^Inbox/ }).click(),
    showsAllSessions: () => page.getByRole("button", { name: "All", exact: true }).click(),
    /** The Inbox button's label, such as "Inbox (2)". */
    inboxLabel: () => page.getByRole("button", { name: /^Inbox/ }).innerText(),
    /** The status bar's count of sessions waiting on the user, such as "2 waiting". */
    statusBarWaitingText: () => page.getByTestId("status-waiting").innerText(),
    /** The titles of the rows the list shows now, top to bottom. */
    listedTitles: async (): Promise<string[]> =>
      Promise.all((await rowsOf(page).all()).map(titleOfRow)),
  };
}

function keyboard(page: Page) {
  return {
    /** Puts the keyboard focus on the session's row, as a click on it would. */
    focusesRow: (title: string) => rowOf(page, title).getByRole("button", { name: title }).focus(),
    pressesKey: (key: string) => page.keyboard.press(key),
    /** The title of the row that has the keyboard focus, or "" when none has. */
    focusedRowTitle: async (): Promise<string> => {
      const focused = rowsOf(page).filter({ has: page.locator(":focus") });
      return ((await textOf(focused)).split("\n")[0] ?? "").trim();
    },
  };
}

/** The session list on the left: rows, their badges and Approve / Deny, and the filters. */
export function sessionListPage(page: Page) {
  return {
    ...filters(page),
    ...keyboard(page),
    /** Opens the session the list shows first. */
    opensTheFirstListedSession: () => rowsOf(page).first().getByRole("button").first().click(),
    opensSession: (title: string) =>
      rowOf(page, title).getByRole("button", { name: title }).click(),
    approvesFromTheRow: (title: string) =>
      rowOf(page, title)
        .getByRole("button", { name: /^Approve/ })
        .click(),
    deniesFromTheRow: (title: string) =>
      rowOf(page, title).getByRole("button", { name: /^Deny/ }).click(),
    /** The text of the session's row, or undefined when the list has no such row. */
    rowTextOf: async (title: string): Promise<string | undefined> => {
      return (await textsOf(rowOf(page, title)))[0];
    },
    /** How many Approve buttons the session's row offers. */
    approveButtonsOf: (title: string) =>
      rowOf(page, title)
        .getByRole("button", { name: /^Approve/ })
        .count(),
  };
}
