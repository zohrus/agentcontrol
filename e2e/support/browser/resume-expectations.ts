import { pageEventually, quote } from "./browser-expectations.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

/** The open session offers a Resume button: its agent stopped when the relay did. */
export function expectResumeToBeOffered(app: AppInBrowser): Promise<void> {
  return pageEventually("expected the open session to offer Resume", async () => {
    return (await app.page.offersResume()) ? undefined : "it does not";
  });
}

/** The open session no longer offers Resume: a new agent runs for it. */
export function expectResumeNotToBeOffered(app: AppInBrowser): Promise<void> {
  return pageEventually("expected the open session to stop offering Resume", async () => {
    return (await app.page.offersResume()) ? "it still does" : undefined;
  });
}

/** The conversation does not show this text any more (call it once the page shows what replaced it). */
export function expectStreamNotToShow(app: AppInBrowser, text: string): Promise<void> {
  return pageEventually(`expected the conversation not to show ${quote(text)}`, async () => {
    const stream = await app.page.streamText();
    return stream.includes(text) ? `it shows ${quote(stream)}` : undefined;
  });
}

/** The session's row carries a "resume" badge: only the user can get this session going again. */
export function expectSessionRowToShowResumeBadge(app: AppInBrowser, title: string): Promise<void> {
  return pageEventually(`expected the row of "${title}" to show a resume badge`, async () => {
    const row = await app.page.rowTextOf(title);
    if (row === undefined) return "the list has no such row";
    return /\bresume\b/.test(row) ? undefined : `the row reads ${quote(row)}`;
  });
}

/** The Inbox button counts this many sessions waiting on the user. */
export function expectInboxToCount(app: AppInBrowser, sessions: number): Promise<void> {
  return pageEventually(`expected the Inbox to count ${String(sessions)}`, async () => {
    const label = await app.page.inboxLabel();
    return label === `Inbox (${String(sessions)})` ? undefined : `it reads ${quote(label)}`;
  });
}

/** The status bar says this many sessions are waiting. */
export function expectStatusBarToCountWaiting(app: AppInBrowser, sessions: number): Promise<void> {
  return pageEventually(
    `expected the status bar to count ${String(sessions)} waiting`,
    async () => {
      const text = await app.page.statusBarWaitingText();
      return text === `${String(sessions)} waiting` ? undefined : `it reads ${quote(text)}`;
    },
  );
}
