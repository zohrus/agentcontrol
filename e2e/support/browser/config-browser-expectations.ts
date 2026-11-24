import { pageEventually, quote } from "./browser-expectations.ts";
import { expectNoFile } from "../expect/config-expectations.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";
import type { ConfigAppInBrowser } from "./start-config-app-in-browser.ts";

const missingFrom = (shown: string, texts: string[]): string[] =>
  texts.filter((text) => !shown.includes(text));

/** The Config screen shows all of these texts. */
export function expectConfigToShow(app: AppInBrowser, ...texts: string[]): Promise<void> {
  return pageEventually(
    `expected the Config screen to show ${texts.map(quote).join(", ")}`,
    async () => {
      const shown = await app.page.configText();
      const missing = missingFrom(shown, texts);
      return missing.length === 0 ? undefined : `it lacks ${missing.map(quote).join(", ")}`;
    },
  );
}

/** The Config screen shows none of these texts. */
export function expectConfigNotToShow(app: AppInBrowser, text: string): Promise<void> {
  return pageEventually(`expected the Config screen not to show ${quote(text)}`, async () => {
    const shown = await app.page.configText();
    return shown.includes(text) ? `it shows ${quote(text)}` : undefined;
  });
}

/** The review lists this file under the agent's name, with what happens to it. */
export function expectReviewToListFile(
  app: AppInBrowser,
  call: { agent: string; file: string; action: string },
): Promise<void> {
  const expectation = `expected the review to list ${call.file} under ${call.agent} as "${call.action}"`;
  return pageEventually(expectation, async () => {
    const shown = await app.page.reviewOfAgent(call.agent);
    if (!shown.includes(call.file)) return `${call.agent} reads ${quote(shown)}`;
    return shown.includes(call.action) ? undefined : `${call.agent} reads ${quote(shown)}`;
  });
}

/** The review says this about what was not written. */
export function expectReviewToExplain(app: AppInBrowser, text: string): Promise<void> {
  return pageEventually(`expected the review to explain ${quote(text)}`, async () => {
    const note = await app.page.notWrittenNote();
    return note.includes(text) ? undefined : `the note reads ${quote(note)}`;
  });
}

/** The "edited by hand" banner names this file. */
export function expectDriftBannerToName(app: AppInBrowser, file: string): Promise<void> {
  return pageEventually(`expected the drift banner to name ${file}`, async () => {
    const banner = await app.page.driftBannerText();
    return banner.includes(file) ? undefined : `the banner reads ${quote(banner)}`;
  });
}

/** There is no "edited by hand" banner. */
export function expectNoDriftBanner(app: AppInBrowser): Promise<void> {
  return pageEventually("expected no drift banner", async () => {
    const banner = await app.page.driftBannerText();
    return banner === "" ? undefined : `the banner reads ${quote(banner)}`;
  });
}

/** The warning before an undo over later changes names this file. */
export function expectUndoWarningToName(app: AppInBrowser, file: string): Promise<void> {
  return pageEventually(`expected the undo warning to name ${file}`, async () => {
    const warning = await app.page.undoWarningText();
    return warning.includes(file) ? undefined : `the warning reads ${quote(warning)}`;
  });
}

/** Neither agent's config file exists in the home folder: nothing has been written. */
export async function expectNoAgentFilesToBeWritten(app: ConfigAppInBrowser): Promise<void> {
  await expectNoFile(app.home, ".claude.json");
  await expectNoFile(app.home, ".codex/config.toml");
}

/** The open form says this, for example what is missing from it. */
export function expectFormToSay(
  app: AppInBrowser,
  call: { verb: string; noun: string; text: string },
): Promise<void> {
  return pageEventually(`expected the ${call.noun} form to say ${quote(call.text)}`, async () => {
    const shown = await app.page.formText(call.verb, call.noun);
    return shown.includes(call.text) ? undefined : `the form reads ${quote(shown)}`;
  });
}

/** The app keeps the item, switched off. */
export function expectItemToBeSwitchedOff(app: AppInBrowser, itemId: string): Promise<void> {
  return pageEventually(`expected item ${itemId} to be kept and switched off`, async () => {
    const held = (await app.sdk.config.list()).find((scoped) => scoped.item.id === itemId);
    if (held === undefined) return "the app does not hold it";
    return held.enabled ? "it is still switched on" : undefined;
  });
}

/** The review has a group for this scope, and it lists these files. */
export function expectReviewGroupToListFiles(
  app: AppInBrowser,
  call: { scope: string; files: string[] },
): Promise<void> {
  const expectation = `expected the review's group "${call.scope}" to list ${call.files.join(", ")}`;
  return pageEventually(expectation, async () => {
    const shown = await app.page.reviewOfScope(call.scope);
    const missing = call.files.filter((file) => !shown.includes(file));
    return missing.length === 0 ? undefined : `the group reads ${quote(shown)}`;
  });
}
