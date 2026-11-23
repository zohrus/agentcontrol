import { afterAll } from "bun:test";
import type { BrowserContextOptions } from "playwright";
import { onTestEnd } from "../setup/cleanup.ts";
import { type Browser, launchChromium, type Page } from "./playwright.ts";

let shared: Promise<Browser> | undefined;

/** One Chromium for the whole test file, started by its first test and closed after its last. */
function sharedChromium(): Promise<Browser> {
  shared ??= launchChromium().catch((error: unknown) => {
    shared = undefined;
    throw error;
  });
  return shared;
}

afterAll(async () => {
  const browser = await shared?.catch(() => undefined);
  shared = undefined;
  await browser?.close();
});

/** A tab in its own browser context (its own storage), closed when the test ends. */
export async function openTab(options: BrowserContextOptions = {}): Promise<Page> {
  const context = await (await sharedChromium()).newContext(options);
  onTestEnd(() => context.close());
  return context.newPage();
}
