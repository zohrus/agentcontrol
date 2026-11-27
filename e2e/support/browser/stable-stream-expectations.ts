import { pageEventually, quote } from "./browser-expectations.ts";
import type { HeaderBox, ItemBox, StreamView } from "./stable-stream-page.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

/** Layout is measured in fractions of a pixel; this much difference is no difference. */
const SAME_WITHIN_PX = 0.5;

const same = (a: number, b: number): boolean => Math.abs(a - b) <= SAME_WITHIN_PX;

/** The view is still where the user scrolled it to: same scroll position, same paragraph in the same place. */
export async function expectViewStayedWhereTheUserScrolled(
  app: AppInBrowser,
  before: StreamView,
): Promise<void> {
  const now = await app.page.streamView();
  const kept =
    same(now.scrollTop, before.scrollTop) &&
    now.firstBlock.text === before.firstBlock.text &&
    same(now.firstBlock.top, before.firstBlock.top);
  if (kept) return;
  throw new Error(
    `expected the view to stay where the user scrolled it (${quote(before.firstBlock.text)} at ` +
      `${String(before.firstBlock.top)} px, scrolled ${String(before.scrollTop)} px), but it shows ` +
      `${quote(now.firstBlock.text)} at ${String(now.firstBlock.top)} px, scrolled ${String(now.scrollTop)} px`,
  );
}

/** The view follows the end of the conversation: the last line is in view. */
export function expectStreamToBeAtTheEnd(app: AppInBrowser): Promise<void> {
  return pageEventually("expected the conversation to be scrolled to its end", async () => {
    const { fromEnd } = await app.page.streamView();
    return fromEnd <= 1 ? undefined : `it is ${String(Math.round(fromEnd))} px short of the end`;
  });
}

/** A "Jump to latest" button is on offer. */
export function expectJumpToLatestOffered(app: AppInBrowser): Promise<void> {
  return pageEventually('expected a "Jump to latest" button to be offered', async () =>
    (await app.page.offersJumpToLatest()) ? undefined : "there is none",
  );
}

/** No "Jump to latest" button is on offer. */
export function expectNoJumpToLatest(app: AppInBrowser): Promise<void> {
  return pageEventually('expected no "Jump to latest" button', async () =>
    (await app.page.offersJumpToLatest()) ? "one is offered" : undefined,
  );
}

/** The conversation has the height it had: the button lies over it and takes no room. */
export async function expectConversationToKeepItsHeight(
  app: AppInBrowser,
  height: number,
): Promise<void> {
  const now = await app.page.streamBoxHeight();
  if (same(now, height)) return;
  throw new Error(
    `expected the conversation to keep its height of ${String(height)} px, but it is ${String(now)} px`,
  );
}

async function markedOrFail(app: AppInBrowser, mark: string, what: string): Promise<ItemBox> {
  const item = await app.page.markedItem(mark);
  if (item) return item;
  throw new Error(`expected ${what} to be the same element as before, but it was drawn anew`);
}

/** The item the test marked, as it is now: where it is and how tall. */
export const theMarkedItem = (app: AppInBrowser, mark: string): Promise<ItemBox> =>
  markedOrFail(app, mark, "the marked item");

/** The item is the very element the test marked, in the same place in the conversation. */
export async function expectSameElementInTheSamePlace(
  app: AppInBrowser,
  call: { mark: string; what: string; before: ItemBox },
): Promise<void> {
  const item = await markedOrFail(app, call.mark, call.what);
  if (same(item.top, call.before.top)) return;
  throw new Error(
    `expected ${call.what} to stay at ${String(call.before.top)} px, but it is at ${String(item.top)} px`,
  );
}

/** The card is where it was and at least as tall, so nothing below it was ever pulled up. */
export async function expectCardKeptItsPlaceAndSize(
  app: AppInBrowser,
  call: { mark: string; before: ItemBox },
): Promise<void> {
  const what = "the card";
  await expectSameElementInTheSamePlace(app, { ...call, what });
  const item = await markedOrFail(app, call.mark, what);
  if (item.height >= call.before.height - SAME_WITHIN_PX) return;
  throw new Error(
    `expected the card to be at least ${String(call.before.height)} px tall, but it is ${String(item.height)} px`,
  );
}

/** The item is the same element, in the same place, and exactly as tall. */
export async function expectItemKeptItsElementPlaceAndSize(
  app: AppInBrowser,
  call: { mark: string; what: string; before: ItemBox },
): Promise<void> {
  await expectSameElementInTheSamePlace(app, call);
  const item = await markedOrFail(app, call.mark, call.what);
  if (same(item.height, call.before.height)) return;
  throw new Error(
    `expected ${call.what} to stay ${String(call.before.height)} px tall, but it is ${String(item.height)} px`,
  );
}

/** The marked block is shut: only the user opens things. */
export async function expectBlockToBeClosed(app: AppInBrowser, mark: string): Promise<void> {
  if (!(await app.page.markedItemIsOpen(mark))) return;
  throw new Error("expected the block to be closed, as the user left it, but it is open");
}

/** The marked card still says this. */
export function expectCardToStillShow(
  app: AppInBrowser,
  call: { mark: string; text: string },
): Promise<void> {
  return pageEventually(`expected the card to still show ${quote(call.text)}`, async () => {
    const item = await app.page.markedItem(call.mark);
    return item?.text.includes(call.text) ? undefined : `it says ${quote(item?.text ?? "")}`;
  });
}

/** The marked card now says this: it grew in place instead of being drawn again. */
export function expectSameElementAfterSecondRead(
  app: AppInBrowser,
  call: { mark: string; says: string },
): Promise<void> {
  return pageEventually(`expected the first lookup's card to say ${quote(call.says)}`, async () => {
    const item = await app.page.markedItem(call.mark);
    if (!item) return "that card was replaced by a new element";
    return item.text.includes(call.says) ? undefined : `it says ${quote(item.text)}`;
  });
}

/** The header is as tall as it was, and its title is in the same place, as wide and in as many lines. */
export async function expectHeaderToKeepItsShape(
  app: AppInBrowser,
  before: HeaderBox,
): Promise<void> {
  const now = await app.page.sessionHeader();
  const kept =
    same(now.height, before.height) &&
    same(now.titleTop, before.titleTop) &&
    same(now.titleWidth, before.titleWidth) &&
    now.titleLines === before.titleLines;
  if (kept) return;
  throw new Error(`expected the header to stay ${shapeOf(before)}, but it is ${shapeOf(now)}`);
}

const shapeOf = (box: HeaderBox): string =>
  `${String(box.height)} px tall with a title ${String(box.titleWidth)} px wide in ${String(box.titleLines)} line(s) at ${String(box.titleTop)} px`;

/** The last row of the conversation says this. */
export function expectLastRowToSay(app: AppInBrowser, text: string): Promise<void> {
  return pageEventually(
    `expected the last row of the conversation to say ${quote(text)}`,
    async () => {
      const last = await app.page.lastItem();
      return last?.text.includes(text) ? undefined : `it says ${quote(last?.text ?? "")}`;
    },
  );
}

/** The end-of-turn line sits where the "Working" row was and is as tall. */
export async function expectEndOfTurnLineInPlaceOfWorkingRow(
  app: AppInBrowser,
  working: ItemBox,
): Promise<void> {
  await expectLastRowToSay(app, "Turn ended");
  const last = await app.page.lastItem();
  if (last && same(last.top, working.top) && same(last.height, working.height)) return;
  throw new Error(
    `expected the end-of-turn line at ${String(working.top)} px, ${String(working.height)} px tall, ` +
      `where the working row was, but it is ${describe(last)}`,
  );
}

const describe = (item: ItemBox | undefined): string =>
  item ? `at ${String(item.top)} px, ${String(item.height)} px tall` : "not there";
