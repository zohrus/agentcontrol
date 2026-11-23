import { type Browser, chromium } from "playwright";

export type { Browser, Locator, Page } from "playwright";

/** Starts a headless Chromium (the browser Playwright installed, or PLAYWRIGHT_BROWSERS_PATH). */
export function launchChromium(): Promise<Browser> {
  return chromium.launch();
}
