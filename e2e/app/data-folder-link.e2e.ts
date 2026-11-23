import { afterEach, test } from "bun:test";
import { readModifyConfig } from "@agentcontrol/app";
import { expectUiScriptToBeServed } from "../support/expect/release-expectations.ts";
import { expectLiveUiFileToContain } from "../support/expect/ui-file-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startReleaseApp } from "../support/setup/release-app.ts";
import { aResourcesFolder, aResourcesFolderWithTools } from "../support/setup/release-folder.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("an app whose data folder is reached through a link still prepares its UI on the first start", async () => {
  // ********************************************************************
  // ** GIVEN a release's resources folder with a default UI
  // ********************************************************************
  const resources = await aResourcesFolder("linked");

  // ********************************************************************
  // ** WHEN the app starts for the first time on a data folder given as a link
  // ********************************************************************
  const modify = readModifyConfig({ AGENTCONTROL_RESOURCES: resources.path });
  const app = await startAppWithLocalWorkspace({ modify, dataFolderBehindALink: true });

  // ********************************************************************
  // ** THEN the live UI is made from the default UI, as on any other data folder
  // ********************************************************************
  await expectLiveUiFileToContain(app, { path: "src/session-table.ts", text: "columns" });
});

test("the UI server serves the UI's script when the data folder is reached through a link", async () => {
  // ********************************************************************
  // ** GIVEN a resources folder with a default UI and Vite in its dependencies
  // ********************************************************************
  const resources = await aResourcesFolderWithTools();

  // ********************************************************************
  // ** WHEN the app starts like a release on a data folder given as a link
  // ********************************************************************
  const app = await startReleaseApp(resources, { dataFolderBehindALink: true });

  // ********************************************************************
  // ** THEN the UI's script is served, not refused as outside Vite's allowed folders
  // ********************************************************************
  await expectUiScriptToBeServed(app);
});
