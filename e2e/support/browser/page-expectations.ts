import { pageEventually, quote } from "./browser-expectations.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

const missingFrom = (shown: string, texts: string[]): string[] =>
  texts.filter((text) => !shown.includes(text));

/** Somewhere on the page these texts are shown. */
export function expectPageToShow(app: AppInBrowser, ...texts: string[]): Promise<void> {
  return pageEventually(`expected the page to show ${texts.map(quote).join(", ")}`, async () => {
    const shown = await app.page.bodyText();
    const missing = missingFrom(shown, texts);
    return missing.length === 0 ? undefined : `it lacks ${missing.map(quote).join(", ")}`;
  });
}

/** The conversation shows all of these texts. */
export function expectStreamToShowAll(app: AppInBrowser, ...texts: string[]): Promise<void> {
  return pageEventually(
    `expected the conversation to show ${texts.map(quote).join(", ")}`,
    async () => {
      const stream = await app.page.streamText();
      const missing = missingFrom(stream, texts);
      return missing.length === 0 ? undefined : `it reads ${quote(stream)}`;
    },
  );
}

/** The open dialog shows all of these texts. */
export function expectDialogToShow(app: AppInBrowser, ...texts: string[]): Promise<void> {
  return pageEventually(`expected the dialog to show ${texts.map(quote).join(", ")}`, async () => {
    const dialog = await app.page.dialogText();
    const missing = missingFrom(dialog, texts);
    return missing.length === 0 ? undefined : `it reads ${quote(dialog)}`;
  });
}

/** No dialog is open. */
export function expectNoDialogToBeOpen(app: AppInBrowser): Promise<void> {
  return pageEventually("expected no dialog to be open", async () => {
    const dialog = await app.page.dialogText();
    return dialog === "" ? undefined : `a dialog reads ${quote(dialog)}`;
  });
}

/** A message in the corner of the screen says this. */
export function expectToastToShow(app: AppInBrowser, text: string): Promise<void> {
  return pageEventually(`expected a message saying ${quote(text)}`, async () => {
    const toasts = await app.page.toastTexts();
    return toasts.some((toast) => toast.includes(text))
      ? undefined
      : `they read ${quote(toasts.join(" | "))}`;
  });
}

/** No message is shown in the corner of the screen. */
export function expectNoToasts(app: AppInBrowser): Promise<void> {
  return pageEventually("expected no messages in the corner", async () => {
    const toasts = await app.page.toastTexts();
    return toasts.length === 0 ? undefined : `they read ${quote(toasts.join(" | "))}`;
  });
}

/** The status bar says the connection is in this state ("Reconnecting…"). */
export function expectConnectionToSay(app: AppInBrowser, text: string): Promise<void> {
  return pageEventually(`expected the status bar to say ${quote(text)}`, async () => {
    const shown = await app.page.connectionText();
    return shown.startsWith(text) ? undefined : `it says ${quote(shown)}`;
  });
}

/** The session list shows exactly these titles, in this order. */
export function expectListedSessions(app: AppInBrowser, titles: string[]): Promise<void> {
  return pageEventually(`expected the list to show ${titles.map(quote).join(", ")}`, async () => {
    const listed = await app.page.listedTitles();
    return listed.join("|") === titles.join("|")
      ? undefined
      : `it shows ${quote(listed.join(" | "))}`;
  });
}

/** The keyboard focus is on this session's row. */
export function expectFocusOnRowOf(app: AppInBrowser, title: string): Promise<void> {
  return pageEventually(`expected the keyboard focus on the row of "${title}"`, async () => {
    const focused = await app.page.focusedRowTitle();
    return focused === title ? undefined : `it is on ${quote(focused)}`;
  });
}

/** The page address names this session (`#/sessions/<workspace>/<id>`, on this Mac unless said). */
export function expectAddressToOpen(
  app: AppInBrowser,
  id: string,
  workspaceId = "local",
): Promise<void> {
  return pageEventually(`expected the address to open session ${id}`, async () => {
    const hash = await app.page.addressHash();
    const wanted = `#/sessions/${workspaceId}/${id}`;
    return hash === wanted ? undefined : `the address is ${quote(hash)}`;
  });
}

/** The page paints this background color. */
export function expectBackgroundToBe(app: AppInBrowser, color: string): Promise<void> {
  return pageEventually(`expected the page background to be ${color}`, async () => {
    const painted = await app.page.backgroundColor();
    return painted === color ? undefined : `it is ${painted}`;
  });
}

/** The checklist step is in this state ("Passed", "Failed") and its text says this. */
export function expectChecklistStep(
  app: AppInBrowser,
  step: { label: string; state: string; text: string },
): Promise<void> {
  return pageEventually(`expected the "${step.label}" step to be ${step.state}`, async () => {
    const shown = await app.page.checklistStep(step.label);
    if (shown === undefined) return "the step is missing";
    if (shown.state !== step.state) return `it is ${quote(shown.state)}`;
    return shown.text.includes(step.text) ? undefined : `it reads ${quote(shown.text)}`;
  });
}

/** The note above the editor says this. */
export function expectEditorNoticeToSay(app: AppInBrowser, text: string): Promise<void> {
  return pageEventually(`expected the editor note to say ${quote(text)}`, async () => {
    const notice = await app.page.editorNotice();
    return notice.includes(text) ? undefined : `it says ${quote(notice)}`;
  });
}

/** The session's row in the list says this (a badge, a detail line). */
export function expectSessionRowToSay(
  app: AppInBrowser,
  row: { title: string; text: string },
): Promise<void> {
  return pageEventually(
    `expected the row of "${row.title}" to say ${quote(row.text)}`,
    async () => {
      const shown = await app.page.rowTextOf(row.title);
      if (shown === undefined) return "the list has no such row";
      return shown.includes(row.text) ? undefined : `the row reads ${quote(shown)}`;
    },
  );
}

/** The header of the open session shows this time since it started. */
export function expectElapsedTimeToShow(app: AppInBrowser, pattern: RegExp): Promise<void> {
  return pageEventually(
    `expected the header's elapsed time to match ${String(pattern)}`,
    async () => {
      const shown = await app.page.elapsedTimeText();
      return pattern.test(shown) ? undefined : `it shows ${quote(shown)}`;
    },
  );
}
