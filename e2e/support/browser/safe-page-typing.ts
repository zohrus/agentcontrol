import { onTestEnd } from "../setup/cleanup.ts";
import type { AppAccess } from "../setup/app.ts";
import { eventually } from "../setup/eventually.ts";
import { launchChromium } from "./playwright.ts";

const PAGE_WAIT_MS = 15_000;

/** The recovery page open in a browser, as a person looks at it while something else changes. */
export async function opensTheSafePageToType(app: AppAccess) {
  const browser = await launchChromium();
  onTestEnd(() => browser.close());
  const page = await browser.newPage();
  await page.goto(`${app.baseUrl}/_safe`);
  return {
    typesInTheRequestBox: (text: string) => page.locator("#request").fill(text),
    requestBoxText: () => page.locator("#request").inputValue(),

    /** Waits until the status part of the page says this, without the page being loaded again. */
    waitsForTheStatusToSay: (text: string) =>
      eventually(
        `expected the recovery page's status to say "${text}"`,
        async () => {
          const shown = await page.locator("body").innerText();
          return shown.includes(text) ? undefined : `it says "${shown}"`;
        },
        PAGE_WAIT_MS,
      ),
  };
}
