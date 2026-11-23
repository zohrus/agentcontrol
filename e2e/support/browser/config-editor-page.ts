import type { Page } from "./playwright.ts";
import { textOf } from "./read-text.ts";

/** What the user types into an item's form, by the label of each box, and where it applies. */
export type ItemForm = {
  /** What kind of item it is: "MCP server", "hook", "skill". */
  noun: string;
  fields: Record<string, string>;
  /** The tab the item belongs to, opened first when given. */
  tab?: string;
  /** The folder of a repository the item is limited to; all repositories when left out. */
  onlyIn?: string;
};

const screenOf = (page: Page) => page.getByRole("dialog", { name: "Config", exact: true });

const editorOf = (page: Page, call: { verb: string; noun: string }) =>
  page.getByRole("dialog", { name: `${call.verb} ${call.noun}`, exact: true });

/** Types into the open form: each box by its label, and the repository the item is limited to. */
async function fillsTheForm(page: Page, call: { verb: string; form: ItemForm }): Promise<void> {
  const { form } = call;
  const editor = editorOf(page, { verb: call.verb, noun: form.noun });
  for (const [label, value] of Object.entries(form.fields)) {
    await editor.getByLabel(label, { exact: true }).fill(value);
  }
  if (form.onlyIn) {
    await editor.getByLabel("Where it applies").selectOption({ label: `Only ${form.onlyIn}` });
  }
}

/** Opens a form from the tab, fills it in and saves; `verb` is "Add" or "Edit". */
async function savesTheFilledForm(
  page: Page,
  call: { verb: string; form: ItemForm; opens: () => Promise<void> },
): Promise<void> {
  await call.opens();
  await fillsTheForm(page, call);
  const editor = editorOf(page, { verb: call.verb, noun: call.form.noun });
  await editor.getByRole("button", { name: "Save", exact: true }).click();
}

const addButtonOf = (page: Page, noun: string) =>
  screenOf(page).getByRole("button", { name: `Add ${noun}` });

/** The open form: what it says and its Save button. */
function openForm(page: Page) {
  return {
    opensTheFormFor: (noun: string) => addButtonOf(page, noun).click(),
    savesTheForm: (verb: string, noun: string) =>
      editorOf(page, { verb, noun }).getByRole("button", { name: "Save", exact: true }).click(),
    /** What the open form says, such as the problem with what was typed; "" when it is closed. */
    formText: async (verb: string, noun: string): Promise<string> => {
      const editor = editorOf(page, { verb, noun });
      return textOf(editor);
    },
  };
}

/** The form that adds or changes one item of the Config screen. */
export function configEditorPage(page: Page) {
  const screen = screenOf(page);
  const opensTab = async (tab: string | undefined): Promise<void> => {
    if (tab) await screen.getByRole("tab", { name: tab, exact: true }).click();
  };
  const addsItem = (form: ItemForm) => {
    const opens = async () => {
      await opensTab(form.tab);
      await addButtonOf(page, form.noun).click();
    };
    return savesTheFilledForm(page, { verb: "Add", form, opens });
  };
  const row = (title: string) => screen.getByRole("listitem", { name: title });
  return {
    ...openForm(page),
    /** Opens the form for a new item, fills it in and saves it. */
    addsItem,
    addsMcpServer: (server: { name: string; command: string }) =>
      addsItem({ noun: "MCP server", fields: { Name: server.name, Command: server.command } }),
    /** Opens the item's form, changes what is typed in it and saves. */
    editsItem: (title: string, form: ItemForm) =>
      savesTheFilledForm(page, {
        verb: "Edit",
        form,
        opens: () => row(title).getByRole("button", { name: "Edit" }).click(),
      }),
  };
}
