import { join } from "node:path";
import type { Session } from "../setup/app.ts";
import { expectStreamToShow } from "./browser-expectations.ts";
import { expectJumpToLatestOffered, theMarkedItem } from "./stable-stream-expectations.ts";
import type { ItemBox } from "./stable-stream-page.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

/** A point in the agent's turn where it waits until the test lets it go on. */
export interface Hold {
  letsTheAgentGoOn(): Promise<void>;
}

/** The agent's next step is to wait: the turn stays open until `letsTheAgentGoOn`. */
export function theAgentWaitsForTheTest(app: AppInBrowser): Hold {
  const path = join(app.mockAgent.dataFolder, `hold-${crypto.randomUUID()}`);
  app.mockAgent.willWaitForFile(path);
  return {
    letsTheAgentGoOn: async () => {
      await Bun.write(path, "go");
    },
  };
}

/** The agent writes the paragraphs "Paragraph 1 of the answer." and so on, one update each. */
function theAgentWritesParagraphs(app: AppInBrowser, range: { from: number; to: number }): void {
  for (let number = range.from; number <= range.to; number++) {
    app.mockAgent.willReply(`Paragraph ${String(number)} of the answer.\n\n`);
  }
}

export const paragraph = (number: number): string => `Paragraph ${String(number)} of the answer.`;

/** The paragraphs the long answer has before, between and after its two holds. */
export const LONG_ANSWER = { first: 40, second: 50, last: 60 };

/**
 * A session whose agent writes 40 paragraphs, waits, writes 10 more, waits, and writes the last
 * one. It is open in the browser, showing the first 40.
 */
export async function aSessionWritingALongAnswerOpenInTheBrowser(app: AppInBrowser) {
  theAgentWritesParagraphs(app, { from: 1, to: LONG_ANSWER.first });
  const firstHold = theAgentWaitsForTheTest(app);
  theAgentWritesParagraphs(app, { from: LONG_ANSWER.first + 1, to: LONG_ANSWER.second });
  const secondHold = theAgentWaitsForTheTest(app);
  theAgentWritesParagraphs(app, { from: LONG_ANSWER.last, to: LONG_ANSWER.last });
  const session: Session = await app.user.startsSession({ prompt: "Write a long answer" });
  await app.page.opensSession(session.title);
  await expectStreamToShow(app, paragraph(LONG_ANSWER.first));
  return { session, firstHold, secondHold };
}

/** Waits for the permission card to be shown, tags its element with `mark`, and says where it is. */
export async function theCardMarkedAs(app: AppInBrowser, mark: string): Promise<ItemBox> {
  await expectStreamToShow(app, "Reject");
  await app.page.marksTheItemWith("Reject", mark);
  return theMarkedItem(app, mark);
}

/** A long answer whose reader scrolled up, while the agent wrote ten more paragraphs out of view. */
export async function aUserWhoScrolledUpWhileTheAgentWroteMore(app: AppInBrowser) {
  const answer = await aSessionWritingALongAnswerOpenInTheBrowser(app);
  await app.page.scrollsTheStreamUp(400);
  await answer.firstHold.letsTheAgentGoOn();
  await expectJumpToLatestOffered(app);
  return answer;
}

/** The agent goes on and writes paragraphs 41 to 50, and they are all in the conversation. */
export async function theAgentWritesTenMoreParagraphs(
  app: AppInBrowser,
  hold: Hold,
): Promise<void> {
  await hold.letsTheAgentGoOn();
  await expectStreamToShow(app, paragraph(LONG_ANSWER.second));
}
