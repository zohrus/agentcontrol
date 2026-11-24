import { pageEventually, quote } from "./browser-expectations.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

/** The message box holds exactly this text. */
export function expectMessageBoxToHold(app: AppInBrowser, text: string): Promise<void> {
  return pageEventually(`expected the message box to hold ${quote(text)}`, async () => {
    const held = await app.page.messageBoxText();
    return held === text ? undefined : `it holds ${quote(held)}`;
  });
}
