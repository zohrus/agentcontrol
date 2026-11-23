import type { Page } from "./playwright.ts";
import { firstTextOf, textOf } from "./read-text.ts";

/** The insights and the status bar, which sit around the table and charts. */
function aroundTheTable(page: Page) {
  const insight = (rule: string) => page.locator(`[data-testid="insight-${rule}"]`);
  return {
    /** The sentence of one insight (by rule name), or "" when it is not listed. */
    insightText: async (rule: string): Promise<string> => textOf(insight(rule)),
    /** Presses a session's name under an insight. */
    opensSessionFromInsight: (call: { rule: string; title: string }) =>
      insight(call.rule).getByRole("button", { name: call.title }).click(),
    /** The "today" figure of the status bar, such as "<$0.01 today". */
    statusBarToday: (): Promise<string> => page.locator('[data-testid="status-today"]').innerText(),
  };
}

/** What a person sees and does on the Analytics screen, in the words of the UI. */
export function analyticsPage(page: Page) {
  const view = page.locator('[data-testid="analytics-view"]');
  return {
    ...aroundTheTable(page),
    /** The text of the whole Analytics screen, or "" when it is not open. */
    analyticsText: (): Promise<string> => textOf(view),
    /** The big number of a headline tile ("Sessions", "Tokens", "Cost", ...). */
    headlineValue: (label: string): Promise<string> =>
      textOf(page.locator(`[data-testid="headline-${label}"]`)),
    /** Presses a column heading of the session table ("Tokens", "Cost", ...). */
    sortsTheTableBy: (heading: string) =>
      view.getByRole("columnheader", { name: heading }).getByRole("button").click(),
    /** The session titles of the table, top to bottom. */
    tableTitles: (): Promise<string[]> =>
      page.locator('[data-testid="analytics-row"] td:first-child').allInnerTexts(),
    /** Presses a session's title in the table. */
    opensSessionFromTheTable: (title: string) =>
      page.locator('[data-testid="analytics-row"]').getByRole("button", { name: title }).click(),
    /** The title in the open session's header, or "" when no session is open. */
    openSessionTitle: (): Promise<string> => firstTextOf(page.locator("header h4")),
  };
}
