import type { Page } from "./playwright.ts";

/** The most a reaction is waited for; a longer one is reported as "never". */
const NEVER_MS = 10_000;

/** Starts timing at the user's first input and resolves when the page shows `shown`. */
const WATCH = `(shown, never) => {
  let started = null;
  const mark = () => { started ??= performance.now(); };
  for (const type of ["pointerdown", "keydown", "click"]) {
    window.addEventListener(type, mark, { capture: true, once: true });
  }
  const isShown = new Function("return (" + shown + ")");
  window.__reaction = new Promise((resolve) => {
    const check = () => {
      if (started === null || !isShown()) return false;
      resolve(performance.now() - started);
      return true;
    };
    const observer = new MutationObserver(() => { if (check()) observer.disconnect(); });
    observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
    setTimeout(() => { observer.disconnect(); resolve(null); }, never);
  });
}`;

/**
 * What the user waited for after one action: the milliseconds, measured in the browser, from their
 * first input (pointer, key or click) until `shown` (a JavaScript expression about the page) was
 * true; undefined when it did not happen within ten seconds. `shown` must be false before `act`.
 */
export async function reactionTime(
  page: Page,
  call: { shown: string; act: () => Promise<void> },
): Promise<number | undefined> {
  await page.evaluate(`(${WATCH})(${JSON.stringify(call.shown)}, ${String(NEVER_MS)})`);
  await call.act();
  const took = await page.evaluate<number | null>("window.__reaction");
  return took ?? undefined;
}

/** A page expression that is true while the page text contains `text`. */
export const pageShows = (text: string): string =>
  `document.body.innerText.includes(${JSON.stringify(text)})`;
