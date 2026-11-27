import { type SlowSetup, theRepoSetupWaitsForTheTest } from "../setup/slow-setup.ts";
import { expectNoUnsentWarning, expectQueueToHold } from "./queue-expectations.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

/**
 * A session just created whose setup is still running, and a first prompt the user has already
 * written and sent: it waits in the queue above the message box. Returns the setup, to be finished or broken.
 */
export async function aSessionWithAQueuedFirstPrompt(
  app: AppInBrowser,
  prompt: string,
): Promise<SlowSetup> {
  await app.mockAgent.writeScript();
  const setup = await theRepoSetupWaitsForTheTest(app);
  await app.page.createsSession({ agent: "Mock agent", repoPath: app.repoPath });
  await app.page.sendsTheFirstPrompt(prompt);
  await expectQueueToHold(app, prompt);
  // A session that is only starting has not failed: nothing says the message was not sent.
  await expectNoUnsentWarning(app);
  return setup;
}
