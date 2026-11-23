import type { RunningApp } from "../setup/start-app.ts";
import { openTab, type Page } from "./playwright.ts";

const CALL_WAIT_MS = 15_000;

/** What the recovery page's script sent to the app, and how the app answered. */
export interface SafePageCall {
  status: number;
  authorization: string | undefined;
}

/** The recovery page open in a real browser tab. */
export interface SafePageInABrowser {
  /** The next call the page's script makes that carries the app's current secret. */
  nextCallWithTheCurrentSecret(): Promise<SafePageCall>;
}

async function nextCall(tab: Page, app: RunningApp): Promise<SafePageCall> {
  const wanted = `Bearer ${app.token}`;
  const request = await tab
    .waitForRequest(
      (seen) =>
        seen.url() === `${app.baseUrl}/api/modify` && seen.headers()["authorization"] === wanted,
      { timeout: CALL_WAIT_MS },
    )
    .catch(() => {
      throw new Error("expected the recovery page to call the app with the app's current secret");
    });
  const response = await request.response();
  return { status: response?.status() ?? 0, authorization: request.headers()["authorization"] };
}

/** Opens `/_safe` in a headless browser, as a user whose UI is broken would. */
export async function opensTheSafePageInABrowser(app: RunningApp): Promise<SafePageInABrowser> {
  const tab = await openTab();
  await tab.goto(`${app.baseUrl}/_safe`);
  return { nextCallWithTheCurrentSecret: () => nextCall(tab, app) };
}
