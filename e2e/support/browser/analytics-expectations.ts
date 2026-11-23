import { type AppInBrowser, openInBrowser } from "./start-app-in-browser.ts";
import { pageEventually, quote } from "./browser-expectations.ts";
import type { SeededSession } from "../setup/seeded-analytics.ts";
import { startAppWithSeededSessions } from "../setup/seeded-app.ts";

/** The app with these seeded sessions, open in a browser. */
export async function startSeededAppInBrowser(sessions: SeededSession[]): Promise<AppInBrowser> {
  const app = await startAppWithSeededSessions(sessions, { withUi: true });
  return openInBrowser(app);
}

/** The Analytics screen soon shows this text somewhere. */
export function expectAnalyticsToShow(app: AppInBrowser, text: string): Promise<void> {
  return pageEventually(`expected the Analytics screen to show ${quote(text)}`, async () => {
    const shown = await app.page.analyticsText();
    return shown.includes(text) ? undefined : `it shows ${quote(shown.slice(0, 200))}`;
  });
}

/** A headline tile of the Analytics screen soon shows this value. */
export function expectHeadlineToShow(
  app: AppInBrowser,
  call: { label: string; value: string },
): Promise<void> {
  return pageEventually(
    `expected the "${call.label}" number to show ${quote(call.value)}`,
    async () => {
      const value = await app.page.headlineValue(call.label);
      return value === call.value ? undefined : `it shows ${quote(value)}`;
    },
  );
}

/** The session table soon lists these titles in this order. */
export function expectTableOrder(app: AppInBrowser, titles: string[]): Promise<void> {
  return pageEventually(`expected the table to list ${JSON.stringify(titles)}`, async () => {
    const shown = await app.page.tableTitles();
    return JSON.stringify(shown) === JSON.stringify(titles)
      ? undefined
      : `it lists ${JSON.stringify(shown)}`;
  });
}

/** The insight of this rule soon says this text. */
export function expectInsightToSay(
  app: AppInBrowser,
  call: { rule: string; text: string },
): Promise<void> {
  return pageEventually(
    `expected the "${call.rule}" insight to say ${quote(call.text)}`,
    async () => {
      const shown = await app.page.insightText(call.rule);
      return shown.includes(call.text) ? undefined : `it says ${quote(shown)}`;
    },
  );
}

/** The page opens this session: its header shows the title and the Analytics screen is gone. */
export function expectSessionToBeOpenInstead(app: AppInBrowser, title: string): Promise<void> {
  return pageEventually(`expected session "${title}" to be open`, async () => {
    const header = await app.page.openSessionTitle();
    const analytics = await app.page.analyticsText();
    return header === title && analytics === "" ? undefined : `the header says ${quote(header)}`;
  });
}

/** The status bar's cost for today soon reads this. */
export function expectTodayCostToShow(app: AppInBrowser, text: string): Promise<void> {
  return pageEventually(`expected the status bar to show ${quote(text)}`, async () => {
    const shown = await app.page.statusBarToday();
    return shown === text ? undefined : `it shows ${quote(shown)}`;
  });
}
