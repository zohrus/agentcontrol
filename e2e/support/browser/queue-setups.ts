import { expectStreamToShow } from "./browser-expectations.ts";
import { expectAgentToBeBusy } from "./queue-expectations.ts";
import { theAgentWaitsForTheTest } from "./stable-stream-setups.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

/**
 * A session open in the browser whose agent said "Answer one" and keeps its turn open until the
 * test lets it go; the next turns say "Answer two" (and stay open too) and "Answer three".
 */
export async function aSessionWhoseAgentIsBusy(app: AppInBrowser) {
  app.mockAgent.willReply("Answer one");
  const first = theAgentWaitsForTheTest(app);
  app.mockAgent.onNextPrompt();
  app.mockAgent.willReply("Answer two");
  const second = theAgentWaitsForTheTest(app);
  app.mockAgent.onNextPrompt();
  app.mockAgent.willReply("Answer three");
  const session = await app.user.startsSession({ prompt: "Start the work" });
  await app.page.opensSession(session.title);
  await expectStreamToShow(app, "Answer one");
  await expectAgentToBeBusy(app);
  return { session, turns: { first, second } };
}

/** A busy session with these messages already waiting in its queue. */
export async function aBusySessionWithQueuedMessages(app: AppInBrowser, ...texts: string[]) {
  const busy = await aSessionWhoseAgentIsBusy(app);
  for (const text of texts) await app.page.sendsMessage(text);
  return busy;
}

/**
 * A session open in the browser whose agent works until it is cancelled, with a message queued
 * behind that turn; the next turn says "Done after cancel".
 */
export async function aSessionBeingCancelledWithAQueuedMessage(app: AppInBrowser, text: string) {
  app.mockAgent.willWaitUntilCancelled();
  app.mockAgent.onNextPrompt();
  app.mockAgent.willReply("Done after cancel");
  const session = await app.user.startsSession({ prompt: "Index the whole monorepo" });
  await app.page.opensSession(session.title);
  await expectAgentToBeBusy(app);
  await app.page.sendsMessage(text);
  return session;
}
