import { afterEach, test } from "bun:test";
import { FS_READ_BYTES_LIMIT } from "@agentcontrol/protocol";
import { expectPreviewToBeRefused } from "../support/expect/preview-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  startAppPreviewingGreetingPage,
  startAppWithSessionHolding,
} from "../support/setup/preview-sessions.ts";

afterEach(cleanUpAfterTest);

const SECRET = "the-secret-of-another-folder";

test("a path that climbs out of the worktree is refused and shows nothing", async () => {
  // ********************************************************************
  // ** GIVEN a session whose worktree holds a page
  // ********************************************************************
  const { app, address } = await startAppPreviewingGreetingPage();

  // ********************************************************************
  // ** WHEN the page asks for a file above the worktree
  // ********************************************************************
  const page = await app.user.loadsPreviewNextTo(address, "..%2F..%2F..%2Fetc%2Fpasswd");

  // ********************************************************************
  // ** THEN the app refuses and says so in words
  // ********************************************************************
  expectPreviewToBeRefused(page, { status: 400, leaking: "root:" });
});

test("a link inside the worktree that leads outside it is refused and shows nothing", async () => {
  // ********************************************************************
  // ** GIVEN a session whose worktree has a link to a folder holding a secret
  // ********************************************************************
  const { app, session, address } = await startAppPreviewingGreetingPage();
  const outside = await app.user.hasAFolderOutsideTheWorktreeHolding({ "secret.txt": SECRET });
  await app.user.linksTheWorktreeToAFolderOutsideIt(session, "elsewhere", outside);

  // ********************************************************************
  // ** WHEN the page asks for the secret through the link
  // ********************************************************************
  const page = await app.user.loadsPreviewNextTo(address, "elsewhere/secret.txt");

  // ********************************************************************
  // ** THEN the relay refuses it and the secret is not shown
  // ********************************************************************
  expectPreviewToBeRefused(page, { status: 400, leaking: SECRET });
});

test("the git folder of the worktree is refused", async () => {
  // ********************************************************************
  // ** GIVEN a session whose worktree holds a page
  // ********************************************************************
  const { app, address } = await startAppPreviewingGreetingPage();

  // ********************************************************************
  // ** WHEN the page asks for a file in a .GiT folder
  // ********************************************************************
  const page = await app.user.loadsPreviewNextTo(address, "sub/.GiT/config");

  // ********************************************************************
  // ** THEN the app refuses
  // ********************************************************************
  expectPreviewToBeRefused(page, { status: 400 });
});

test("an address with a broken escape sequence is refused", async () => {
  // ********************************************************************
  // ** GIVEN a session whose worktree holds a page
  // ********************************************************************
  const { app, address } = await startAppPreviewingGreetingPage();

  // ********************************************************************
  // ** WHEN the page asks for a path that is not valid text
  // ********************************************************************
  const page = await app.user.loadsPreviewNextTo(address, "%E0%A4%A");

  // ********************************************************************
  // ** THEN the app refuses
  // ********************************************************************
  expectPreviewToBeRefused(page, { status: 400 });
});

test("a .env file in the worktree is refused and shows nothing", async () => {
  // ********************************************************************
  // ** GIVEN a session whose worktree holds a page and a .env.local file with a secret
  // ********************************************************************
  const { app, session, address } = await startAppPreviewingGreetingPage();
  await app.user.writesFilesInTheWorktree(session, { ".env.local": `KEY=${SECRET}\n` });

  // ********************************************************************
  // ** WHEN the page asks for the .env.local file
  // ********************************************************************
  const page = await app.user.loadsPreviewNextTo(address, ".env.local");

  // ********************************************************************
  // ** THEN the app refuses and the secret is not shown
  // ********************************************************************
  expectPreviewToBeRefused(page, { status: 400, leaking: SECRET });
});

test("a file that does not exist is refused with a plain message", async () => {
  // ********************************************************************
  // ** GIVEN a session whose worktree holds a page
  // ********************************************************************
  const { app, address } = await startAppPreviewingGreetingPage();

  // ********************************************************************
  // ** WHEN the page asks for a file that is not there
  // ********************************************************************
  const page = await app.user.loadsPreviewNextTo(address, "missing.css");

  // ********************************************************************
  // ** THEN the app says it does not exist
  // ********************************************************************
  expectPreviewToBeRefused(page, { status: 404 });
});

test("a file bigger than the relay hands over in one piece is refused", async () => {
  // ********************************************************************
  // ** GIVEN a session whose worktree holds a file one byte over the limit
  // ********************************************************************
  const big = { "big.bin": new Uint8Array(FS_READ_BYTES_LIMIT + 1) };
  const { app, session } = await startAppWithSessionHolding(big);

  // ********************************************************************
  // ** WHEN the page asks for it
  // ********************************************************************
  const address = await app.user.asksForPreviewAddressOf(session, "big.bin");
  const page = await app.user.loadsPreview(address);

  // ********************************************************************
  // ** THEN the app says it is too large
  // ********************************************************************
  expectPreviewToBeRefused(page, { status: 413 });
});
