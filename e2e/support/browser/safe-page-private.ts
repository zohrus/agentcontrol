import type { AppAccess } from "../setup/app.ts";
import { onTestEnd } from "../setup/cleanup.ts";
import { launchChromium } from "./playwright.ts";

const CHECK_WAIT_MS = 15_000;

/** Makes every use of session storage throw, as some private windows do. */
const REFUSE_STORAGE = `
  for (const name of ["getItem", "setItem", "removeItem"]) {
    Storage.prototype[name] = () => { throw new DOMException("denied", "SecurityError"); };
  }
`;

/** The recovery page open in a window whose session storage refuses every use. */
export async function opensTheSafePageWhereStorageIsRefused(app: AppAccess) {
  const browser = await launchChromium();
  onTestEnd(() => browser.close());
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(REFUSE_STORAGE);
  await page.goto(`${app.baseUrl}/_safe`);
  return {
    /** Waits for the page to check the app this many more times (it does so every two seconds). */
    waitsForItToCheckTheApp: async (times: number): Promise<void> => {
      for (let seen = 0; seen < times; seen++) {
        await page.waitForRequest((request) => request.url().endsWith("/api/modify"), {
          timeout: CHECK_WAIT_MS,
        });
      }
    },
    /** What went wrong in the page's own script so far. */
    errorsInThePage: (): string[] => [...errors],
  };
}
