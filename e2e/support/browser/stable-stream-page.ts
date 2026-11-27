import type { Locator, Page } from "./playwright.ts";

/** Where the conversation is scrolled to, and what the user sees first. */
export type StreamView = {
  scrollTop: number;
  /** How far the view is from the end of the conversation, in pixels. */
  fromEnd: number;
  /** The first paragraph that is (at least partly) in view, and where it is on the screen. */
  firstBlock: { text: string; top: number };
};

/** One item of the conversation: its words, and where it sits in the conversation and how tall it is. */
export type ItemBox = { text: string; top: number; height: number };

/** The header over the conversation: how tall it is, and where its title is, how wide and in how many lines. */
export type HeaderBox = {
  height: number;
  titleTop: number;
  titleWidth: number;
  titleLines: number;
};

const logOf = (page: Page): Locator => page.getByRole("log");

/**
 * The scripts below run in the page, which this package has no types for: they are text. Each one
 * is a function expression that is called with the conversation's element and one argument. The
 * locator waits for the element to be mounted before it runs the script.
 */
const inTheStream = <T>(page: Page, script: string, argument: unknown): Promise<T> =>
  runsOn(logOf(page), script, argument);

/** Waits for the element, then runs the script text in the page with the element and the argument. */
export const runsOn = <T>(element: Locator, script: string, argument: unknown): Promise<T> =>
  element.evaluate(
    (found, call) =>
      ((0, eval)(call.script) as (...args: unknown[]) => unknown)(found, call.argument),
    { script, argument },
  ) as Promise<T>;

/** Resolves once the view has stopped moving, as after a wheel turn that scrolls smoothly. */
const UNTIL_SETTLED = `(el) => new Promise((resolve) => {
  let last = -1;
  let still = 0;
  const tick = () => {
    still = el.scrollTop === last ? still + 1 : 0;
    last = el.scrollTop;
    if (still >= 5) resolve(); else requestAnimationFrame(tick);
  };
  tick();
})`;

const VIEW = `(el) => {
  const area = el.getBoundingClientRect();
  const first = [...el.querySelectorAll("p")].find((p) => p.getBoundingClientRect().bottom > area.top);
  const box = first ? first.getBoundingClientRect() : undefined;
  return {
    scrollTop: el.scrollTop,
    fromEnd: el.scrollHeight - el.scrollTop - el.clientHeight,
    firstBlock: { text: first ? first.textContent : "", top: box ? box.top : 0 },
  };
}`;

const SELECT = `(el, wanted) => {
  const found = [...el.querySelectorAll("p")].find((p) => p.textContent.includes(wanted));
  if (found) document.getSelection().selectAllChildren(found);
}`;

const MARK = `(el, call) => {
  const column = el.firstElementChild;
  const item = [...column.children].find((child) => child.textContent.includes(call.text));
  if (item) item.setAttribute("data-test-mark", call.mark);
}`;

const BOX_OF = `(column, item) => {
  const top = item.getBoundingClientRect().top - column.getBoundingClientRect().top;
  return { text: item.innerText, top, height: item.getBoundingClientRect().height };
}`;

const MARKED = `(el, mark) => {
  const item = el.querySelector('[data-test-mark="' + mark + '"]');
  return item ? (${BOX_OF})(el.firstElementChild, item) : undefined;
}`;

const MARKED_IS_OPEN = `(el, mark) => {
  const item = el.querySelector('[data-test-mark="' + mark + '"]');
  return Boolean(item && item.open);
}`;

const LAST = `(el) => {
  const column = el.firstElementChild;
  return column.lastElementChild ? (${BOX_OF})(column, column.lastElementChild) : undefined;
}`;

const HEADER = `(bar) => {
  const title = bar.querySelector("h4");
  const box = title.getBoundingClientRect();
  const lineHeight = parseFloat(getComputedStyle(title).lineHeight);
  return {
    height: bar.getBoundingClientRect().height,
    titleTop: box.top - bar.getBoundingClientRect().top,
    titleWidth: box.width,
    titleLines: Math.round(box.height / lineHeight),
  };
}`;

function scrolling(page: Page) {
  const log = logOf(page);
  const settles = (): Promise<unknown> => inTheStream(page, UNTIL_SETTLED, null);
  return {
    /** Turns the mouse wheel up over the conversation, as a user does, and waits for it to settle. */
    scrollsTheStreamUp: async (pixels: number): Promise<void> => {
      await log.hover();
      await page.mouse.wheel(0, -pixels);
      await settles();
    },
    /** Turns the mouse wheel down over the conversation as far as it goes, and waits for it to settle. */
    scrollsTheStreamToTheEnd: async (): Promise<void> => {
      await log.hover();
      await page.mouse.wheel(0, 1_000_000);
      await settles();
    },
    /** Presses a key with the keyboard focus in the conversation. */
    pressesKeyInTheStream: async (key: string): Promise<void> => {
      await log.focus();
      await page.keyboard.press(key);
      await settles();
    },
    /** Drops the selection, as a click on empty space does. */
    clearsTheSelection: () => page.evaluate("document.getSelection().removeAllRanges()"),
    /** Selects the first paragraph that says this, as a user does to copy it. */
    selectsTextInTheStream: (text: string) => inTheStream(page, SELECT, text),
  };
}

function viewing(page: Page) {
  const log = logOf(page);
  return {
    /** Where the conversation is scrolled to and which paragraph is first in view. */
    streamView: (): Promise<StreamView> => inTheStream<StreamView>(page, VIEW, null),
    /** The height of the conversation's own box: it does not change when a button lies over it. */
    streamBoxHeight: async (): Promise<number> => (await log.boundingBox())?.height ?? 0,
    offersJumpToLatest: async (): Promise<boolean> =>
      (await page.getByRole("button", { name: "Jump to latest" }).count()) > 0,
    pressesJumpToLatest: () => page.getByRole("button", { name: "Jump to latest" }).click(),
  };
}

function items(page: Page) {
  return {
    /** Tags the first item that says this with a marker the page itself never sets or removes. */
    marksTheItemWith: (text: string, mark: string) => inTheStream(page, MARK, { text, mark }),
    /** The item that carries the marker, or undefined when no element carries it any more. */
    markedItem: (mark: string): Promise<ItemBox | undefined> =>
      inTheStream<ItemBox | undefined>(page, MARKED, mark),
    /** Whether the marked item is a block the user has opened. */
    markedItemIsOpen: (mark: string): Promise<boolean> =>
      inTheStream<boolean>(page, MARKED_IS_OPEN, mark),
    /** The last item of the conversation. */
    lastItem: (): Promise<ItemBox | undefined> =>
      inTheStream<ItemBox | undefined>(page, LAST, null),
    /** The header over the conversation. */
    sessionHeader: (): Promise<HeaderBox> =>
      runsOn<HeaderBox>(page.locator("header:has(h4)").first(), HEADER, null),
  };
}

/** What a person measures of the conversation to see whether anything moved. */
export function streamPage(page: Page) {
  return { ...scrolling(page), ...viewing(page), ...items(page) };
}
