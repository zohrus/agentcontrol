import { dialogsPage } from "./dialogs-page.ts";
import type { Page } from "./playwright.ts";

const menuOf = (page: Page) => page.getByRole("dialog", { name: "Workspaces", exact: true });
const addDialogOf = (page: Page) =>
  page.getByRole("dialog", { name: "Add workspace", exact: true });

/** The workspace menu: its rows, and what each row can do. */
function menu(page: Page) {
  const rowOf = (label: string) => menuOf(page).getByRole("listitem", { name: label });
  return {
    closesTheDialog: () => page.keyboard.press("Escape"),
    opensTheWorkspaceMenu: () =>
      page.getByRole("button", { name: "Workspaces", exact: true }).click(),
    /** What the menu says about one workspace: its name, connection and reason. */
    workspaceRowText: async (label: string): Promise<string> =>
      (await rowOf(label).allInnerTexts()).join("\n"),
    restartsTheRelayOf: (label: string) =>
      rowOf(label).getByRole("button", { name: "Restart relay" }).click(),
    removesTheWorkspace: (label: string) =>
      rowOf(label).getByRole("button", { name: "Remove", exact: true }).click(),
    /** The question that stands before restarting or removing, or "" when none is asked. */
    confirmationText: async (title: string): Promise<string> => {
      const question = page.getByRole("dialog", { name: title, exact: true });
      return (await question.allInnerTexts()).join("\n");
    },
    confirms: (title: string, button: string) =>
      page
        .getByRole("dialog", { name: title, exact: true })
        .getByRole("button", { name: button, exact: true })
        .click(),
  };
}

/** The "Add workspace" dialog: host, name, the checklist and Retry. */
function addDialog(page: Page) {
  return {
    choosesAddWorkspace: () => menuOf(page).getByRole("button", { name: "Add workspace…" }).click(),
    typesTheHost: (host: string) => addDialogOf(page).getByLabel("Host").fill(host),
    submitsTheHost: () =>
      addDialogOf(page).getByRole("button", { name: "Add workspace", exact: true }).click(),
    retriesTheSetup: () => addDialogOf(page).getByRole("button", { name: "Retry" }).click(),
  };
}

/** The sessions of one workspace in the list, and starting a session on another machine. */
function onOtherMachines(page: Page) {
  const dialogs = dialogsPage(page);
  return {
    /** What the list says under one workspace's name (its connection, reason and rows). */
    groupText: async (title: string): Promise<string> => {
      const group = page.getByRole("region", { name: title, exact: true });
      return (await group.allInnerTexts()).join("\n");
    },
    /** Opens New session, picks the workspace first, adds the repository there and starts. */
    startsSessionOnWorkspace: async (call: {
      workspace: string;
      repoPath: string;
      prompt: string;
    }): Promise<void> => {
      await dialogs.opensNewSession();
      await page
        .getByRole("dialog")
        .getByRole("combobox", { name: /^Workspace/ })
        .selectOption({ label: call.workspace });
      await dialogs.choosesToAddARepository();
      await dialogs.typesRepositoryFolder(call.repoPath);
      await dialogs.addsTheRepository();
      await dialogs.choosesAgent("Mock agent");
      await dialogs.typesPrompt(call.prompt);
      await dialogs.startsTheSession();
    },
  };
}

/** The workspace menu, adding a workspace, and sessions grouped by workspace. */
export function workspacesPage(page: Page) {
  return { ...menu(page), ...addDialog(page), ...onOtherMachines(page) };
}
