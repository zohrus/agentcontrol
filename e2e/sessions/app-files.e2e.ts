import { afterEach, test } from "bun:test";
import {
  expectFileContent,
  expectSaveRefusedAsConflict,
} from "../support/expect/app-expectations.ts";
import { userOpensReadmeOfFinishedSession } from "../support/setup/app-sessions.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("saving a file from an out-of-date view is refused as a conflict", async () => {
  // ********************************************************************
  // ** GIVEN a session whose README the user has open
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  const { session, opened } = await userOpensReadmeOfFinishedSession(app);
  // AND the file was saved with another edit after the user opened it
  await app.user.savesFile(session, { path: "README.md", content: "# Other\n", basedOn: opened });

  // ********************************************************************
  // ** WHEN the user saves their own edit, made on the earlier view
  // ********************************************************************
  const outcome = await app.user.savesFile(session, {
    path: "README.md",
    content: "# Mine\n",
    basedOn: opened,
  });

  // ********************************************************************
  // ** THEN the save is refused as a conflict
  // ********************************************************************
  expectSaveRefusedAsConflict(outcome, "README.md");
  // AND the file keeps the other edit
  await expectFileContent(app, { session, path: "README.md", content: "# Other\n" });
});
