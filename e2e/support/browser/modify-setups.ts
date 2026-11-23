import { sessionTableWith } from "../setup/fixture-ui.ts";
import {
  type ModifiableApp,
  releaseDefaultUiUpdate,
  startAppWithModifiableUi,
} from "../setup/modify-app.ts";
import {
  modifyAgentKeepsWritingTypeErrors,
  userKeptTableColumns,
} from "../setup/modify-history.ts";
import { expectModifyPanelToShow } from "./modify-browser-expectations.ts";
import { openInBrowser } from "./start-app-in-browser.ts";

const table = "src/session-table.ts";

/** The app with its tiny default UI and the mock Modify agent, and its UI open in a browser. */
export async function startModifiableAppInBrowser() {
  return openInBrowser<ModifiableApp>(await startAppWithModifiableUi({ withUi: true }));
}

type ModifiableAppInBrowser = Awaited<ReturnType<typeof startModifiableAppInBrowser>>;

/** The Modify agent will say what it does and then give the session table these columns. */
async function modifyAgentWillShowColumns(
  app: ModifiableAppInBrowser,
  columns: string[],
): Promise<void> {
  app.mockAgent.willReply("I am adding the columns to the session table.");
  app.mockAgent.willWriteFile(table, sessionTableWith(...columns));
  await app.mockAgent.writeScript();
}

/** The Modify panel is open and the Modify agent will add a Cost column to the session table. */
export async function modifyPanelOpenWithAgentAddingCostColumn() {
  const app = await startModifiableAppInBrowser();
  await modifyAgentWillShowColumns(app, ["Title", "Cost"]);
  await app.page.opensTheModifyPanel();
  return app;
}

/** A cost column change that the Modify agent made and the checks passed, waiting in the panel. */
export async function costColumnChangeReadyInModifyPanel() {
  const app = await modifyPanelOpenWithAgentAddingCostColumn();
  await app.page.asksToModifyTheUi("add a cost column");
  await expectModifyPanelToShow(app, "Ready");
  return app;
}

/** The user kept a cost column change, default UI 1.1 was released, and the open panel offers it. */
export async function defaultUiUpdateOfferedInModifyPanel() {
  const app = await startModifiableAppInBrowser();
  await userKeptTableColumns(app, ["Title", "Status", "Cost"]);
  const files = { "src/footer.ts": 'export const footer = "AgentControl 1.1";\n' };
  await releaseDefaultUiUpdate(app, { version: "1.1", files });
  await app.page.opensTheModifyPanel();
  await expectModifyPanelToShow(app, "Update 1.1 available");
  return app;
}

/** The same, after the user pressed Update: the merge waits for Keep or Undo. */
export async function defaultUiUpdateMergedInModifyPanel() {
  const app = await defaultUiUpdateOfferedInModifyPanel();
  await app.page.appliesTheDefaultUiUpdate();
  await expectModifyPanelToShow(app, "Updated to 1.1.");
  return app;
}

/** The Modify agent writes a session table the checks cannot accept, again after each fix request. */
export async function modifyAgentWillBreakTheTypes(app: ModifiableAppInBrowser): Promise<void> {
  modifyAgentKeepsWritingTypeErrors(app, 3);
  await app.mockAgent.writeScript();
}

/** The Modify agent will ask to run this shell command, which its session never allows. */
export async function modifyAgentWillAskToRunACommand(
  app: ModifiableAppInBrowser,
  command: string,
): Promise<void> {
  app.mockAgent.willAskToRunCommand(command);
  await app.mockAgent.writeScript();
}
