import { afterAll } from "bun:test";
import { type Browser, type BrowserContextOptions, chromium, type Page } from "playwright";
import { onTestEnd } from "../setup/cleanup.ts";

export type { Browser, Locator, Page } from "playwright";

/** Starts a headless Chromium (the browser Playwright installed, or PLAYWRIGHT_BROWSERS_PATH). */
export function launchChromium(): Promise<Browser> {
  return chromium.launch();
}

let shared: Promise<Browser> | undefined;

/** One Chromium for the whole test file, started by its first test and closed after its last. */
function sharedChromium(): Promise<Browser> {
  if (shared === undefined) {
    shared = launchChromium();
    afterAll(async () => {
      const browser = await shared;
      shared = undefined;
      await browser?.close();
    });
  }
  return shared;
}

/** A tab in its own browser context (its own storage), closed when the test ends. */
export async function openTab(options: BrowserContextOptions = {}): Promise<Page> {
  const context = await (await sharedChromium()).newContext(options);
  onTestEnd(() => context.close());
  return context.newPage();
}
