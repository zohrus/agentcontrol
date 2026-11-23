import { join } from "node:path";
import { expectUiChangeReadyToKeep } from "../expect/modify-expectations.ts";
import { sessionTableWith, sessionTableWithTypeError } from "./fixture-ui.ts";
import type { RunningApp } from "./start-app.ts";

/** The user asked for a change, the Modify agent wrote this file, and the user pressed Keep. */
async function userKeptFile(
  app: RunningApp,
  kept: { request: string; path: string; content: string },
): Promise<void> {
  app.mockAgent.willWriteFile(kept.path, kept.content);
  await app.user.asksToModifyTheUi(kept.request);
  await expectUiChangeReadyToKeep(app);
  await app.user.keepsTheChange();
}

/** The user asked for these table columns, the Modify agent made them, and the user pressed Keep. */
export function userKeptTableColumns(app: RunningApp, columns: string[]): Promise<void> {
  const content = sessionTableWith(...columns);
  return userKeptFile(app, {
    request: `show ${columns.join(", ")}`,
    path: "src/session-table.ts",
    content,
  });
}

/**
 * The user asked for a table change and pressed Keep, but the app died before it had forgotten that
 * the change was waiting: the note of the waiting change is still there when the app starts again.
 */
export async function userKeptButTheAppDiedBeforeForgettingTheWaitingChange(
  app: RunningApp,
): Promise<void> {
  const note = join(app.dataDir, "modify-waiting.json");
  app.mockAgent.willWriteFile("src/session-table.ts", sessionTableWith("Title", "Cost"));
  await app.user.asksToModifyTheUi("add a cost column");
  await expectUiChangeReadyToKeep(app);
  const waiting = await Bun.file(note).text();
  await app.user.keepsTheChange();
  await Bun.write(note, waiting);
}

/** The Modify agent writes a type error in its first turn and again in each of `fixes` fix turns. */
export function modifyAgentKeepsWritingTypeErrors(app: RunningApp, fixes: number): void {
  app.mockAgent.willWriteFile("src/session-table.ts", sessionTableWithTypeError);
  for (let fix = 0; fix < fixes; fix++) {
    app.mockAgent.onNextPrompt();
    app.mockAgent.willWriteFile("src/session-table.ts", sessionTableWithTypeError);
  }
}

/** The user kept a Cost column and a footer change, which a default UI update will not touch. */
export async function userKeptCostColumnAndFooter(app: RunningApp): Promise<void> {
  await userKeptTableColumns(app, ["Title", "Status", "Cost"]);
  const content = 'export const footer = "HELLO";\n';
  await userKeptFile(app, { request: "shout in the footer", path: "src/footer.ts", content });
}
