import { quote, pageEventually } from "./browser-expectations.ts";
import type { AppPage } from "./app-page.ts";
import { buildPage } from "./build-page.ts";

/** The page runs React's production build: no development checks, and none of Vite's dev files. */
export async function expectThePageToRunAProductionBuild(shown: AppPage): Promise<void> {
  const page = buildPage(shown.raw);
  await pageEventually("expected React to have rendered the page", async () =>
    (await page.reactRunsInDevelopmentMode()) === undefined ? "it has not" : undefined,
  );
  if ((await page.reactRunsInDevelopmentMode()) === true) {
    throw new Error(
      "expected the page to run React in production mode, but it runs development mode",
    );
  }
  if (await page.loadedDevelopmentServerFiles()) {
    throw new Error(
      "expected the page to load built files only, but it loaded Vite dev server files",
    );
  }
}

/** The page shows this text, without having been reloaded by hand. */
export function expectThePageToShowByItself(page: AppPage, text: string): Promise<void> {
  return pageEventually(`expected the page to show ${quote(text)} by itself`, async () => {
    const shown = await page.bodyText();
    return shown.includes(text) ? undefined : `it reads ${quote(shown)}`;
  });
}
