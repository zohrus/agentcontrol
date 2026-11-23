import { eventually } from "../setup/eventually.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

const BROWSER_WAIT_MS = 15_000;

/** The conversation shows the text; pairs with `expectStreamToShow` for what must be gone. */
export function expectStreamNotToShow(app: AppInBrowser, text: string): Promise<void> {
  return eventually(
    `expected the conversation not to show ${JSON.stringify(text)}`,
    async () => {
      const stream = await app.page.streamText();
      return stream.includes(text) ? `it shows ${JSON.stringify(stream)}` : undefined;
    },
    BROWSER_WAIT_MS,
  );
}
