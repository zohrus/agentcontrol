import { afterEach, test } from "bun:test";
import {
  expectSessionArchived,
  expectSessionIdle,
  expectSessionWaitingForReply,
} from "../support/expect/app-expectations.ts";
import {
  expectAppToRefuse,
  expectRefusalToListFiles,
} from "../support/expect/app-refusal-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

async function startSessionWithUncommittedFile() {
  const app = await startAppWithLocalWorkspace();
  app.mockAgent.willEditFile("src/server.ts");
  const session = await app.user.startsSession({ prompt: "Add a server" });
  await expectSessionWaitingForReply(app, session);
  return { app, session };
}

test("cancelling a running turn from the app ends the turn", async () => {
  // ********************************************************************
  // ** GIVEN an agent whose turn stays open until it is cancelled
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  app.mockAgent.willWaitUntilCancelled();
  const session = await app.user.startsSession({ prompt: "Refactor everything" });

  // ********************************************************************
  // ** WHEN the user cancels the turn
  // ********************************************************************
  await app.user.cancelsTheTurn(session);

  // ********************************************************************
  // ** THEN the session is listed as idle
  // ********************************************************************
  await expectSessionIdle(app, session);
});

test("archiving a session with uncommitted changes is refused with the list of files", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent left src/server.ts uncommitted
  // ********************************************************************
  const { app, session } = await startSessionWithUncommittedFile();

  // ********************************************************************
  // ** WHEN the user archives the session
  // ********************************************************************
  const outcome = await app.user.triesToArchive(session);

  // ********************************************************************
  // ** THEN the app refuses with a conflict that names src/server.ts
  // ********************************************************************
  expectAppToRefuse(outcome, { status: 409, code: "uncommitted-changes" });
  expectRefusalToListFiles(outcome, ["src/server.ts"]);
});

test("archiving anyway archives a session with uncommitted changes", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent left src/server.ts uncommitted
  // ********************************************************************
  const { app, session } = await startSessionWithUncommittedFile();

  // ********************************************************************
  // ** WHEN the user archives the session anyway
  // ********************************************************************
  await app.user.archivesSession(session, { force: true });

  // ********************************************************************
  // ** THEN the session is listed as archived
  // ********************************************************************
  await expectSessionArchived(app, session);
});
