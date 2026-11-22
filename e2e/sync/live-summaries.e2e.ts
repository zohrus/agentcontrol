import { afterEach, test } from "bun:test";
import { expectSessionWaitingForApproval } from "../support/expect/app-expectations.ts";
import {
  expectEveryMessageToNameTheWorkspace,
  expectRecordHoldsRequestToRunCommand,
  expectStreamPushedRequestToRunCommand,
  expectStreamPushedSessionWaitingForReply,
} from "../support/expect/live-stream-expectations.ts";
import { userOpensReadmeOfFinishedSession } from "../support/setup/app-sessions.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { listensToTheLiveStream } from "../support/setup/live-stream.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("a subscriber is pushed the session's request when it appears and when it is answered, without polling", async () => {
  // ********************************************************************
  // ** GIVEN a browser listening to the live stream, and an agent that will ask to run `npm test`
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  const stream = await listensToTheLiveStream(app);
  app.mockAgent.willAskToRunCommand("npm test");
  app.mockAgent.willReply("Tests pass");

  // ********************************************************************
  // ** WHEN the user starts a session
  // ********************************************************************
  const session = await app.user.startsSession({ prompt: "Run the tests" });

  // ********************************************************************
  // ** THEN the stream pushes the session with its request to run `npm test`
  // ********************************************************************
  await expectStreamPushedRequestToRunCommand(stream, { session, command: "npm test" });

  // ********************************************************************
  // ** WHEN the user allows the command
  // ********************************************************************
  await app.user.allowsTheCommand(session);

  // ********************************************************************
  // ** THEN the stream pushes the session waiting for a reply, with no request left
  // ********************************************************************
  await expectStreamPushedSessionWaitingForReply(stream, session);
});

test("the stored session record holds its pending request and open turn", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will ask to run `npm test`
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  app.mockAgent.willAskToRunCommand("npm test");

  // ********************************************************************
  // ** WHEN the user starts a session and it waits for approval
  // ********************************************************************
  const session = await app.user.startsSession({ prompt: "Run the tests" });
  await expectSessionWaitingForApproval(app, session);

  // ********************************************************************
  // ** THEN the session's record holds the request to run `npm test` in an open turn
  // ********************************************************************
  await expectRecordHoldsRequestToRunCommand(app, { session, command: "npm test" });
});

test("records and live messages about a session all name its workspace", async () => {
  // ********************************************************************
  // ** GIVEN a browser listening to the live stream and a finished session whose file it watches
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  const stream = await listensToTheLiveStream(app);
  const { session, opened } = await userOpensReadmeOfFinishedSession(app);
  await app.sdk.files.tree(session.id);

  // ********************************************************************
  // ** WHEN the user saves the file
  // ********************************************************************
  await app.user.savesFile(session, { path: "README.md", content: "# New\n", basedOn: opened });

  // ********************************************************************
  // ** THEN the record, the list, and the live event, session and file messages name one workspace
  // ********************************************************************
  await stream.fileChanges.waitFor(
    () => true,
    "expected the live stream to report the file change",
  );
  await expectEveryMessageToNameTheWorkspace(app, { stream, session });
});
