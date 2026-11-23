import { afterEach, test } from "bun:test";
import { ErrorCode } from "@agentcontrol/protocol";
import {
  expectBytesToBeRead,
  expectBytesToBeRefused,
} from "../support/expect/file-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { PIXEL_PNG } from "../support/setup/preview-pages.ts";
import { startRelayWithSessionWhereAgentEdited } from "../support/setup/relay-sessions.ts";

afterEach(cleanUpAfterTest);

test("the raw bytes of a binary file come back unchanged", async () => {
  // ********************************************************************
  // ** GIVEN a session whose worktree holds a PNG image
  // ********************************************************************
  const { relay, session } = await startRelayWithSessionWhereAgentEdited("README.md");
  await relay.user.putsFileInTheWorktree(session, { path: "img/logo.png", bytes: PIXEL_PNG });

  // ********************************************************************
  // ** WHEN the app asks the relay for the image's bytes
  // ********************************************************************
  const outcome = await relay.user.triesToReadBytesOf(session, "img/logo.png");

  // ********************************************************************
  // ** THEN the bytes are exactly those of the file
  // ********************************************************************
  expectBytesToBeRead(outcome, PIXEL_PNG);
});

test("git's own folder is never handed over, in any letter case", async () => {
  // ********************************************************************
  // ** GIVEN a running session
  // ********************************************************************
  const { relay, session } = await startRelayWithSessionWhereAgentEdited("README.md");

  // ********************************************************************
  // ** WHEN the app asks for a file inside .GIT
  // ********************************************************************
  const outcome = await relay.user.triesToReadBytesOf(session, "sub/.GIT/config");

  // ********************************************************************
  // ** THEN the relay refuses
  // ********************************************************************
  expectBytesToBeRefused(outcome, ErrorCode.invalidParams);
});

test("a link that leads to a secret file is refused like the file itself", async () => {
  // ********************************************************************
  // ** GIVEN a session whose worktree holds a .env file and a link named leak.js to it
  // ********************************************************************
  const { relay, session } = await startRelayWithSessionWhereAgentEdited("README.md");
  const secret = new TextEncoder().encode("TOKEN=abc123\n");
  await relay.user.putsFileInTheWorktree(session, { path: ".env", bytes: secret });
  await relay.user.linksInTheWorktree(session, { from: "leak.js", to: ".env" });

  // ********************************************************************
  // ** WHEN the app asks for the bytes of leak.js
  // ********************************************************************
  const outcome = await relay.user.triesToReadBytesOf(session, "leak.js");

  // ********************************************************************
  // ** THEN the relay refuses
  // ********************************************************************
  expectBytesToBeRefused(outcome, ErrorCode.invalidParams);
});

test("a folder is not a file, and there are no bytes to hand over", async () => {
  // ********************************************************************
  // ** GIVEN a session whose worktree holds a folder
  // ********************************************************************
  const { relay, session } = await startRelayWithSessionWhereAgentEdited("README.md");
  await relay.user.putsFileInTheWorktree(session, { path: "docs/a.txt", bytes: PIXEL_PNG });

  // ********************************************************************
  // ** WHEN the app asks for the bytes of the folder
  // ********************************************************************
  const outcome = await relay.user.triesToReadBytesOf(session, "docs");

  // ********************************************************************
  // ** THEN the relay says there is no such file
  // ********************************************************************
  expectBytesToBeRefused(outcome, ErrorCode.fileNotFound);
});
