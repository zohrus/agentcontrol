import type { Session } from "../setup/app.ts";
import { eventually } from "../setup/eventually.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

const BROWSER_WAIT_MS = 15_000;

const quote = (text: string): string => JSON.stringify(text);

/** Like `eventually`, with the longer wait a page needs to load and render. */
function pageEventually(
  expectation: string,
  observe: () => Promise<string | undefined>,
): Promise<void> {
  return eventually(expectation, observe, BROWSER_WAIT_MS);
}

/** The session's row in the list shows an "approve" badge. */
export function expectSessionRowToShowApproveBadge(
  app: AppInBrowser,
  title: string,
): Promise<void> {
  return pageEventually(`expected the row of "${title}" to show an approve badge`, async () => {
    const row = await app.page.rowTextOf(title);
    if (row === undefined) return "the list has no such row";
    return /\bapprove\b/.test(row) ? undefined : `the row reads ${quote(row)}`;
  });
}

/** The row offers no Approve button any more: the request was answered. */
export function expectSessionRowToOfferNoApproval(app: AppInBrowser, title: string): Promise<void> {
  return pageEventually(`expected the row of "${title}" to offer no approval`, async () => {
    const buttons = await app.page.approveButtonsOf(title);
    return buttons === 0 ? undefined : "it still has an Approve button";
  });
}

/** The conversation stream shows this text, without the page being reloaded. */
export function expectStreamToShow(app: AppInBrowser, text: string): Promise<void> {
  return pageEventually(`expected the conversation to show ${quote(text)}`, async () => {
    const stream = await app.page.streamText();
    return stream.includes(text) ? undefined : `it shows ${quote(stream)}`;
  });
}

/** The conversation shows the text exactly once: nothing was repeated. */
export function expectStreamToShowOnce(app: AppInBrowser, text: string): Promise<void> {
  return pageEventually(`expected the conversation to show ${quote(text)} once`, async () => {
    const times = await app.page.timesTheStreamShows(text);
    return times === 1 ? undefined : `it shows it ${String(times)} times`;
  });
}

/** The status bar says the browser is connected to the app. */
export function expectBrowserToBeConnected(app: AppInBrowser): Promise<void> {
  return pageEventually("expected the status bar to say Connected", async () => {
    const text = await app.page.connectionText();
    return text.startsWith("Connected") ? undefined : `it says ${quote(text)}`;
  });
}

/** The session list shows a row with this title. */
export function expectSessionListed(app: AppInBrowser, title: string): Promise<void> {
  return pageEventually(`expected the session list to show "${title}"`, async () => {
    const row = await app.page.rowTextOf(title);
    return row === undefined ? "the list has no such row" : undefined;
  });
}

/** The Changes tab lists this file among the changed files. */
export function expectChangesTabToList(app: AppInBrowser, path: string): Promise<void> {
  return pageEventually(`expected the Changes tab to list ${path}`, async () => {
    const files = await app.page.changedFiles();
    const listed = files.some((file) => file.startsWith(path));
    return listed ? undefined : `it lists ${quote(files.join(", "))}`;
  });
}

/** The note under the file list says how many of the files it shows, in plain words. */
export function expectFileListToSay(app: AppInBrowser, text: string): Promise<void> {
  return pageEventually(`expected the file list to say ${quote(text)}`, async () => {
    const notice = await app.page.fileListNotice();
    return notice.includes(text) ? undefined : `it says ${quote(notice)}`;
  });
}

/** The diff of the open file shows this text. */
export function expectDiffToShow(app: AppInBrowser, text: string): Promise<void> {
  return pageEventually(`expected the diff to show ${quote(text)}`, async () => {
    const diff = await app.page.diffText();
    return diff.includes(text) ? undefined : `it shows ${quote(diff)}`;
  });
}

/** The editor shows this text. */
export function expectEditorToShow(app: AppInBrowser, text: string): Promise<void> {
  return pageEventually(`expected the editor to show ${quote(text)}`, async () => {
    const shown = await app.page.editorText();
    return shown.includes(text) ? undefined : `it shows ${quote(shown)}`;
  });
}

/** The archive dialog warns that unsaved changes would be lost and lists these files. */
export function expectArchiveWarningToList(app: AppInBrowser, files: string[]): Promise<void> {
  return pageEventually(`expected the archive warning to list ${files.join(", ")}`, async () => {
    const dialog = await app.page.dialogText();
    const missing = files.filter((file) => !dialog.includes(file));
    return missing.length === 0 ? undefined : `the dialog reads ${quote(dialog)}`;
  });
}

/** The Archived filter of the session list shows this session. */
export async function expectSessionUnderArchived(app: AppInBrowser, title: string): Promise<void> {
  await app.page.showsArchivedSessions();
  await expectSessionListed(app, title);
}

/** The file in the session's worktree ends up holding exactly this content. */
export function expectFileToBeSaved(
  app: AppInBrowser,
  call: { session: Session; path: string; content: string },
): Promise<void> {
  const { session, path, content } = call;
  return pageEventually(`expected ${path} to be saved with ${quote(content)}`, async () => {
    const saved = await app.sdk.files.read({ id: session.id, path });
    return saved.content === content ? undefined : `it holds ${quote(saved.content)}`;
  });
}

/** The open session's header shows this usage chip text. */
export function expectUsageChipToShow(app: AppInBrowser, text: string): Promise<void> {
  return pageEventually(`expected the usage chip to show ${quote(text)}`, async () => {
    const chip = await app.page.usageChipText();
    return chip === text ? undefined : `it shows ${quote(chip)}`;
  });
}
