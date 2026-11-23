import { pageEventually, quote } from "./browser-expectations.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

/** The terminal shows a line that is exactly `line` (the typed command's echo is not one). */
export async function expectTerminalToShowLine(app: AppInBrowser, line: string): Promise<string> {
  let found = "";
  await pageEventually(`expected the terminal to show the line ${quote(line)}`, async () => {
    const text = await app.page.terminalText();
    const match = new RegExp(`^(?:.*[#$] )?(${line})\\s*$`, "m").exec(text);
    found = match?.[1] ?? "";
    return match === null ? `it shows ${quote(text.slice(-200))}` : undefined;
  });
  return found;
}

/** The terminal shows a prompt: the shell has started. */
export function expectTerminalToShowAPrompt(app: AppInBrowser): Promise<void> {
  return pageEventually("expected the terminal to show a prompt", async () => {
    const text = await app.page.terminalText();
    return /[#$] /.test(text) ? undefined : `it shows ${quote(text.slice(-200))}`;
  });
}

/** The bar under the terminal says the shell ended, with this text in it. */
export function expectTerminalToExplainItEnded(app: AppInBrowser, text: string): Promise<void> {
  return pageEventually(`expected the terminal to say the shell ended (${text})`, async () => {
    const note = await app.page.terminalEndNote();
    return note.includes(text) ? undefined : `its note reads ${quote(note)}`;
  });
}
