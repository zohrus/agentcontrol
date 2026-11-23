import { expectFocusOnRowOf } from "./page-expectations.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

/** Focuses the top row, presses j (focus moves below), k (back on top) and j again. */
export async function walksDownUpAndDownTheList(
  app: AppInBrowser,
  rows: { top: string; below: string },
): Promise<void> {
  await app.page.focusesRow(rows.top);
  await app.page.pressesKey("j");
  await expectFocusOnRowOf(app, rows.below);
  await app.page.pressesKey("k");
  await expectFocusOnRowOf(app, rows.top);
  await app.page.pressesKey("j");
}
