import { onTestEnd } from "../setup/cleanup.ts";
import { type RunningApp, startAppWithLocalWorkspace } from "../setup/start-app.ts";
import { type AppPage, appPageOf } from "./app-page.ts";
import { launchChromium, type Page } from "./playwright.ts";

const CONNECT_TIMEOUT_MS = 60_000;

/** A browser test alone takes 5 to 10 s; this leaves room for a busy machine (Vite and Chromium start per test). */
export const BROWSER_TEST_TIMEOUT_MS = 60_000;

/** The running app together with a browser tab showing its UI. */
export type AppInBrowser = RunningApp & { readonly page: AppPage };

export type BrowserOptions = {
  viewport?: { width: number; height: number };
  colorScheme?: "light" | "dark";
};

async function waitUntilConnected(page: Page): Promise<void> {
  const connected = page.getByRole("status").filter({ hasText: /^Connected/ });
  await connected.first().waitFor({ state: "visible", timeout: CONNECT_TIMEOUT_MS });
}

/** Opens the UI of an app that was started `withUi` in a headless browser. */
export async function openInBrowser<A extends RunningApp>(
  app: A,
  options: BrowserOptions = {},
): Promise<A & { readonly page: AppPage }> {
  const browser = await launchChromium();
  onTestEnd(() => browser.close());
  const tab = await browser.newPage(options);
  await tab.goto(app.baseUrl);
  await waitUntilConnected(tab);
  return Object.assign(app, { page: appPageOf(tab) });
}

/** Starts the app with the mock agent and its UI, and opens the UI in a headless browser. */
export async function startAppInBrowser(options: BrowserOptions = {}): Promise<AppInBrowser> {
  return openInBrowser(await startAppWithLocalWorkspace({ withUi: true }), options);
}
