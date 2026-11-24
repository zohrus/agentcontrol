import { type SlowSetup, theRepoSetupWaitsForTheTest } from "../setup/slow-setup.ts";
import { expectPageToShow } from "./page-expectations.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

/**
 * A session just created whose setup is still running, and a first prompt the user has already
 * written and sent: the page says it is queued. Returns the setup, to be finished or broken.
 */
export async function aSessionWithAQueuedFirstPrompt(
  app: AppInBrowser,
  prompt: string,
): Promise<SlowSetup> {
  await app.mockAgent.writeScript();
  const setup = await theRepoSetupWaitsForTheTest(app);
  await app.page.createsSession({ agent: "Mock agent", repoPath: app.repoPath });
  await app.page.sendsTheFirstPrompt(prompt);
  await expectPageToShow(app, "Queued: it is sent as the first message");
  return setup;
}
