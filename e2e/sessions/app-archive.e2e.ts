import { afterEach, test } from "bun:test";
import {
  expectSessionArchived,
  expectSessionWaitingForReply,
} from "../support/expect/app-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("an archived session leaves the active list and stays under archived sessions", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent has finished its turn
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  app.mockAgent.willReply("Done");
  const session = await app.user.startsSession({ prompt: "Tidy the readme" });
  await expectSessionWaitingForReply(app, session);

  // ********************************************************************
  // ** WHEN the user archives the session
  // ********************************************************************
  await app.user.archivesSession(session);

  // ********************************************************************
  // ** THEN the session is listed as archived and not as active
  // ********************************************************************
  await expectSessionArchived(app, session);
});
