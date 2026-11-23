import { pageEventually, quote } from "./browser-expectations.ts";
import type { Page } from "./playwright.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

/** The "Open in browser VS Code" button can be clicked. */
export function expectBrowserVsCodeButtonToBeEnabled(app: AppInBrowser): Promise<void> {
  return pageEventually("expected the Open in browser VS Code button to be enabled", async () =>
    (await app.page.browserVsCodeButtonIsEnabled()) ? undefined : "it is disabled",
  );
}

/** The button is disabled and its note says why, with this text in it. */
export function expectBrowserVsCodeButtonToBeDisabledBecause(
  app: AppInBrowser,
  reason: string,
): Promise<void> {
  return pageEventually(
    `expected the Open in browser VS Code button to be disabled because "${reason}"`,
    async () => {
      const enabled = await app.page.browserVsCodeButtonIsEnabled();
      const note = await app.page.browserVsCodeButtonNote();
      if (enabled) return "it is enabled";
      return note.includes(reason) ? undefined : `its note reads ${quote(note)}`;
    },
  );
}

/** The new tab shows code-server's workbench, served from another port than the app's. */
export async function expectNewTabToShowTheWorkbench(call: {
  app: AppInBrowser;
  tab: Page;
}): Promise<void> {
  await call.tab.waitForFunction("document.title === 'workbench loaded'", undefined, {
    timeout: 15_000,
  });
  const here = new URL(call.tab.url());
  const appPort = new URL(call.app.baseUrl).port;
  if (here.port === appPort || here.hostname !== "127.0.0.1") {
    throw new Error(
      `expected the workbench on another port than the app's (${appPort}), but it is at ${call.tab.url()}`,
    );
  }
}

/** What a script on the IDE's origin could do to the app: every attempt was blocked by the browser. */
export async function expectScriptsOnTheIdeOriginToBeBlocked(tab: Page): Promise<void> {
  await tab.waitForFunction("document.title === 'done'", undefined, { timeout: 15_000 });
  const result = await tab.evaluate<Record<string, string>>("window.__result");
  const readable = Object.entries(result).filter(([, outcome]) => outcome !== "blocked");
  if (Object.keys(result).length === 0 || readable.length > 0) {
    throw new Error(
      `expected a script on the IDE's origin to be blocked from the app, but it got: ${JSON.stringify(result)}`,
    );
  }
}
