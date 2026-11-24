import { reactionTime } from "./reaction.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

/** What the user does, and what they should see at once because of it. */
export interface Reaction {
  /** Names the action in the printed numbers, e.g. "Create session". */
  action: string;
  /** What the user does (a click, a key). Everything the page shows before it is not counted. */
  act: () => Promise<void>;
  /** A JavaScript expression about the page that is true once the page has reacted. */
  shown: string;
  /** In plain words: what the page should show, for the failure message. */
  reads: string;
  /**
   * Lets the slow back end go on. Only used by `bun run measure:reactions`, which sets
   * `REACTION_BACKEND_MS` so the back end answers that long after the action: an interface that
   * waits for it then reads that long, and one that does not reads a few milliseconds.
   */
  backEndAnswers?: () => void | Promise<void>;
}

/** The back end answers this long after the action when measuring; undefined in normal runs. */
function backEndDelayMs(): number | undefined {
  const text = Bun.env["REACTION_BACKEND_MS"];
  return text === undefined ? undefined : Number(text);
}

/**
 * What to wait for: the reaction's own expression, or, when measuring an older interface,
 * the one `REACTION_SHOWN` (a JSON object of expressions by action name) gives for it.
 */
function shownFor(reaction: Reaction): string {
  const text = Bun.env["REACTION_SHOWN"];
  const others = text === undefined ? {} : (JSON.parse(text) as Record<string, string>);
  return others[reaction.action] ?? reaction.shown;
}

/**
 * The page reacts to the action while the slow back end is still held: the reaction is seen and
 * its time (measured in the browser, from the first input) is printed as `REACTION | <action> | <ms>`.
 * Fails in words when the page did not react at all.
 */
export async function expectPageToReactAtOnce(
  app: AppInBrowser,
  reaction: Reaction,
): Promise<number> {
  const delay = backEndDelayMs();
  const answers = reaction.backEndAnswers;
  if (delay !== undefined && answers) {
    setTimeout(() => {
      void answers();
    }, delay);
  }
  const took = await reactionTime(app.page.raw, { ...reaction, shown: shownFor(reaction) });
  if (took === undefined) {
    throw new Error(
      `expected the page to ${reaction.reads} as soon as the user pressed "${reaction.action}", ` +
        "but it had still not shown it 10 seconds later, while the back end was held",
    );
  }
  console.log(`REACTION | ${reaction.action} | ${String(Math.round(took))} ms`);
  return took;
}

/** The page reacts at once to each of the steps, in turn. */
export async function expectPageToReactAtEveryStep(
  app: AppInBrowser,
  steps: readonly Reaction[],
): Promise<void> {
  for (const step of steps) await expectPageToReactAtOnce(app, step);
}
