import { afterEach, test } from "bun:test";
import {
  expectModifyRequestRefusedAutomatically,
  expectUiChangeFailed,
} from "../support/expect/modify-expectations.ts";
import { expectLiveUiFileNotToContain } from "../support/expect/ui-file-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithModifiableUi } from "../support/setup/modify-app.ts";

afterEach(cleanUpAfterTest);

test("the Modify agent's request to run a shell command is refused automatically and recorded", async () => {
  // ********************************************************************
  // ** GIVEN the Modify agent will ask to run `npm install`
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  app.mockAgent.willAskToRunCommand("npm install");

  // ********************************************************************
  // ** WHEN the user asks for a change
  // ********************************************************************
  await app.user.asksToModifyTheUi("add a cost column");

  // ********************************************************************
  // ** THEN the relay refused the command by itself, and the log says so
  // ********************************************************************
  await expectModifyRequestRefusedAutomatically(app, { toolCallMentions: "npm install" });
  // AND without any change the attempt ends as failed
  await expectUiChangeFailed(app);
});

test("the Modify agent's attempt to edit a file outside ui-staging is refused", async () => {
  // ********************************************************************
  // ** GIVEN the Modify agent will try to edit a file of the live UI
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  app.mockAgent.willWriteFile("../ui/src/footer.ts", 'export const footer = "hacked";\n');

  // ********************************************************************
  // ** WHEN the user asks for a change
  // ********************************************************************
  await app.user.asksToModifyTheUi("change the footer");

  // ********************************************************************
  // ** THEN the relay refused the edit by itself, and the live UI is untouched
  // ********************************************************************
  await expectModifyRequestRefusedAutomatically(app, { toolCallMentions: "ui/src/footer.ts" });
  await expectLiveUiFileNotToContain(app, { path: "src/footer.ts", text: "hacked" });
  // AND the attempt ends as failed, since nothing was changed
  await expectUiChangeFailed(app);
});
