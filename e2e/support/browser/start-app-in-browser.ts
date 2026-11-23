import { onTestEnd } from "../setup/cleanup.ts";
import { type RunningApp, startAppWithLocalWorkspace } from "../setup/start-app.ts";
import { type AppPage, appPageOf } from "./app-page.ts";
import { type Browser, launchChromium, type Page } from "./playwright.ts";
import { recordBrowserCoverage } from "./ui-coverage/collect.ts";

const CONNECT_TIMEOUT_MS = 60_000;

/** A browser test alone takes 5 to 10 s; this leaves room for a busy machine (Vite and Chromium start per test). */
export const BROWSER_TEST_TIMEOUT_MS = 60_000;

/** The running app together with a browser tab showing its UI. */
export type AppInBrowser = RunningApp & { readonly page: AppPage };

export type BrowserOptions = {
  viewport?: { width: number; height: number };
  colorScheme?: "light" | "dark";
  /** Extra environment for the relay, for example to point git at a config file. */
  relayEnv?: Record<string, string>;
  /** The page's clock can be moved forward, so hours and days pass at once. */
  controllableClock?: boolean;
  /** The browser refuses to store anything, as in a locked-down private window. */
  storageBlocked?: boolean;
};

async function waitUntilConnected(page: Page): Promise<void> {
  const connected = page.getByRole("status").filter({ hasText: /^Connected/ });
  await connected.first().waitFor({ state: "visible", timeout: CONNECT_TIMEOUT_MS });
}

/** Makes `sessionStorage` throw, as some privacy modes do. */
const REFUSE_STORAGE = `Object.defineProperty(window, "sessionStorage", {
  get: () => { throw new DOMException("blocked", "SecurityError"); },
});`;

async function prepareTab(tab: Page, options: BrowserOptions): Promise<void> {
  await recordBrowserCoverage(tab);
  if (options.controllableClock) await tab.clock.install();
  if (options.storageBlocked) await tab.addInitScript(REFUSE_STORAGE);
}

/** Opens the UI of an app that was started `withUi` in a headless browser. */
export async function openInBrowser<A extends RunningApp>(
  app: A,
  options: BrowserOptions = {},
): Promise<A & { readonly page: AppPage }> {
  const browser: Browser = await launchChromium();
  onTestEnd(() => browser.close());
  const { viewport, colorScheme } = options;
  const tab = await browser.newPage({
    ...(viewport && { viewport }),
    ...(colorScheme && { colorScheme }),
  });
  await prepareTab(tab, options);
  await tab.goto(app.baseUrl);
  await waitUntilConnected(tab);
  return Object.assign(app, { page: appPageOf(tab) });
}

/** Starts the app with the mock agent and its UI, and opens the UI in a headless browser. */
export async function startAppInBrowser(options: BrowserOptions = {}): Promise<AppInBrowser> {
  const { relayEnv } = options;
  const app = await startAppWithLocalWorkspace({ withUi: true, ...(relayEnv && { relayEnv }) });
  return openInBrowser(app, options);
}
