import { afterEach, test } from "bun:test";
import { readModifyConfig } from "@agentcontrol/app";
import {
  expectEveryMigrationToBeApplied,
  expectReadingTheDefaultUiToFailSaying,
  expectUiDependenciesToComeFrom,
  expectUiServedFromTheDataFolder,
} from "../support/expect/release-expectations.ts";
import { expectLiveUiFileToContain } from "../support/expect/ui-file-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { theMigrationsOfTheRepository } from "../support/setup/drizzle-folder.ts";
import { startReleaseApp } from "../support/setup/release-app.ts";
import { aResourcesFolder, aResourcesFolderWithTools } from "../support/setup/release-folder.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

const inFolder = (path: string) => ({ AGENTCONTROL_RESOURCES: path });

test("an app finds its default UI in the resources folder it is given and prepares the UI from it", async () => {
  // ********************************************************************
  // ** GIVEN a release's resources folder with a default UI and its dependencies
  // ********************************************************************
  const resources = await aResourcesFolder("first");

  // ********************************************************************
  // ** WHEN the app starts with that resources folder
  // ********************************************************************
  const modify = readModifyConfig(inFolder(resources.path));
  const app = await startAppWithLocalWorkspace({ modify });

  // ********************************************************************
  // ** THEN the live UI is made from the default UI in it, with its dependencies
  // ********************************************************************
  await expectLiveUiFileToContain(app, { path: "src/session-table.ts", text: "columns" });
  await expectUiDependenciesToComeFrom(app, resources);
});

test("an app whose release moved finds the dependencies of the new place", async () => {
  // ********************************************************************
  // ** GIVEN the app ran from one resources folder
  // ********************************************************************
  const before = await aResourcesFolder("before");
  const app = await startAppWithLocalWorkspace({ modify: readModifyConfig(inFolder(before.path)) });
  // AND the app was updated: the release now lives in another folder
  const after = await aResourcesFolder("after");

  // ********************************************************************
  // ** WHEN the app starts again from the new resources folder
  // ********************************************************************
  await app.restartsTheApp({ modify: readModifyConfig(inFolder(after.path)) });

  // ********************************************************************
  // ** THEN the UI uses the dependencies of the new folder
  // ********************************************************************
  await expectUiDependenciesToComeFrom(app, after);
});

test("an app without a default UI says where it looked", () => {
  // ********************************************************************
  // ** GIVEN a resources folder that has no default UI
  // ********************************************************************
  const missing = "/nonexistent/agentcontrol-resources";

  // ********************************************************************
  // ** WHEN the app reads where its default UI is
  // ********************************************************************
  const read = () => readModifyConfig(inFolder(missing));

  // ********************************************************************
  // ** THEN it fails, naming the place it looked
  // ********************************************************************
  expectReadingTheDefaultUiToFailSaying(read, `${missing}/ui-template`);
});

test("an app started like a release serves the UI of its data folder with Vite", async () => {
  // ********************************************************************
  // ** GIVEN a resources folder with a default UI, and Vite in its dependencies
  // ********************************************************************
  const resources = await aResourcesFolderWithTools();

  // ********************************************************************
  // ** WHEN the app starts with no UI flags, only that resources folder
  // ********************************************************************
  const app = await startReleaseApp(resources);

  // ********************************************************************
  // ** THEN the root address serves the UI that was made in the data folder
  // ********************************************************************
  await expectUiServedFromTheDataFolder(app);
});

test("the database of a new app has every migration the repository has", async () => {
  // ********************************************************************
  // ** GIVEN the repository's migrations
  // ********************************************************************
  const repository = await theMigrationsOfTheRepository();

  // ********************************************************************
  // ** WHEN the app starts on an empty data folder
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** THEN its database got all of them
  // ********************************************************************
  expectEveryMigrationToBeApplied(app, repository);
});
