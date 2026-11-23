import type { Page } from "./playwright.ts";

const screenOf = (page: Page) => page.getByRole("dialog", { name: "Config", exact: true });

/** The Config screen's tabs, items and the editor that adds or changes one. */
function items(page: Page) {
  const screen = screenOf(page);
  return {
    opensConfig: () => page.getByRole("button", { name: "Config", exact: true }).click(),
    opensTab: (label: string) => screen.getByRole("tab", { name: label, exact: true }).click(),
    switchesOff: (title: string) =>
      screen.getByRole("listitem", { name: title }).getByRole("checkbox").click(),
    deletes: (title: string) =>
      screen.getByRole("listitem", { name: title }).getByRole("button", { name: "Delete" }).click(),
    /** The text of the Config screen, or "" while it is covered or closed. */
    configText: async (): Promise<string> =>
      (await screen.count()) === 0 ? "" : screen.innerText(),
  };
}

/** Review changes, Apply and Undo. */
function changes(page: Page) {
  const screen = screenOf(page);
  const region = (name: string) => screen.getByRole("region", { name, exact: true });
  return {
    reviewsTheChanges: () => screen.getByRole("button", { name: "Review changes" }).click(),
    appliesTheChanges: () => screen.getByRole("button", { name: /^Apply/ }).click(),
    goesBackToEditing: () => screen.getByRole("button", { name: "Back to editing" }).click(),
    doneWithTheApply: () => screen.getByRole("button", { name: "Done", exact: true }).click(),
    undoesTheApply: () => screen.getByRole("button", { name: "Undo this apply" }).click(),
    cancelsTheUndoWarning: () =>
      page
        .getByRole("dialog", { name: "Files changed since" })
        .getByRole("button", { name: "Cancel" })
        .click(),
    confirmsUndoAnyway: () =>
      page
        .getByRole("dialog", { name: "Files changed since" })
        .getByRole("button", { name: "Undo anyway" })
        .click(),
    /** What the review says under one agent's name, or "" when it has no section. */
    reviewOfAgent: async (agent: string): Promise<string> =>
      (await region(agent).count()) === 0 ? "" : region(agent).innerText(),
    /** The review's note on what was not written, or "". */
    notWrittenNote: async (): Promise<string> =>
      (await region("Not written").count()) === 0 ? "" : region("Not written").innerText(),
  };
}

/** Import existing setup and the drift banner. */
function importAndDrift(page: Page) {
  const screen = screenOf(page);
  const region = (name: string) => screen.getByRole("region", { name, exact: true });
  return {
    importsExistingSetup: () =>
      screen.getByRole("button", { name: "Import existing setup" }).click(),
    adoptsTheSelection: () => screen.getByRole("button", { name: /^Adopt/ }).click(),
    keepsMyManualEdit: () => screen.getByRole("button", { name: "Keep my manual edit" }).click(),
    writesTheEntryAgain: () => screen.getByRole("button", { name: "Write it again" }).click(),
    overwritesMyManualEdit: () => screen.getByRole("button", { name: "Overwrite" }).click(),
    /** The text of the "edited by hand" banner, or "" when there is none. */
    driftBannerText: async (): Promise<string> =>
      (await region("Edited by hand").count()) === 0 ? "" : region("Edited by hand").innerText(),
    /** What the files-changed-since confirmation says, or "". */
    undoWarningText: async (): Promise<string> => {
      const warning = page.getByRole("dialog", { name: "Files changed since" });
      return (await warning.count()) === 0 ? "" : warning.innerText();
    },
  };
}

/** The Config screen: items by kind, the review of changes, undo, import and drift. */
export function configPage(page: Page) {
  return { ...items(page), ...changes(page), ...importAndDrift(page) };
}
