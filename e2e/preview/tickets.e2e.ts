import { afterEach, test } from "bun:test";
import {
  expectPreviewToBeExactly,
  expectPreviewToBeFencedIn,
  expectPreviewToBeRefused,
} from "../support/expect/preview-expectations.ts";
import {
  expectDifferentAddresses,
  expectNoPreviewAddressToBeGiven,
  expectSameTicket,
} from "../support/expect/preview-refusal-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { GREETING_PAGE } from "../support/setup/preview-pages.ts";
import {
  startAppPreviewingGreetingPage,
  startsSessionThatFinished,
} from "../support/setup/preview-sessions.ts";
import { addressWithTicket } from "../support/setup/preview-user.ts";

afterEach(cleanUpAfterTest);

const SECRET = "the-secret-of-another-session";

test("an address with a ticket the app never gave out is refused", async () => {
  // ********************************************************************
  // ** GIVEN a session whose worktree holds a page
  // ********************************************************************
  const { app, address } = await startAppPreviewingGreetingPage();

  // ********************************************************************
  // ** WHEN the page is loaded with a made-up ticket
  // ********************************************************************
  const page = await app.user.loadsPreview(addressWithTicket(address, "made-up"));

  // ********************************************************************
  // ** THEN the app refuses, and the refusal itself is sandboxed too
  // ********************************************************************
  expectPreviewToBeRefused(page, { status: 404, leaking: "Hello" });
  expectPreviewToBeFencedIn(page);
});

test("an address whose ticket has expired is refused", async () => {
  // ********************************************************************
  // ** GIVEN an app where preview tickets expire at once, and a session holding a page
  // ********************************************************************
  const { app, session, address } = await startAppPreviewingGreetingPage({
    previewLifetimeMs: 0,
  });

  // ********************************************************************
  // ** WHEN the user loads the page with a ticket that has run out, and asks for a new address
  // ********************************************************************
  const page = await app.user.loadsPreview(address);
  const again = await app.user.asksForPreviewAddressOf(session, "page.html");

  // ********************************************************************
  // ** THEN the app refuses
  // ********************************************************************
  expectPreviewToBeRefused(page, { status: 404, leaking: "Hello" });
  // AND the new address carries a new ticket, which has run out as well
  expectPreviewToBeRefused(await app.user.loadsPreview(again), { status: 404 });
});

test("asking again for a session's address gives the same ticket and a different address", async () => {
  // ********************************************************************
  // ** GIVEN a session with a preview address
  // ********************************************************************
  const { app, session, address } = await startAppPreviewingGreetingPage();

  // ********************************************************************
  // ** WHEN the user asks for the address of the same page again
  // ********************************************************************
  const again = await app.user.asksForPreviewAddressOf(session, "page.html");

  // ********************************************************************
  // ** THEN the ticket is the same, so a page that is open keeps working
  // ********************************************************************
  expectSameTicket(address, again);
  // AND the address differs, so a frame shown the new one loads the page again
  expectDifferentAddresses(address, again);
});

test("a ticket stops working when its session is archived, and no new one is given", async () => {
  // ********************************************************************
  // ** GIVEN a session with a preview address that works
  // ********************************************************************
  const { app, session, address } = await startAppPreviewingGreetingPage();
  expectPreviewToBeExactly(await app.user.loadsPreview(address), GREETING_PAGE);

  // ********************************************************************
  // ** WHEN the user archives the session
  // ********************************************************************
  await app.user.archivesSession(session, { force: true });

  // ********************************************************************
  // ** THEN the old address is refused
  // ********************************************************************
  expectPreviewToBeRefused(await app.user.loadsPreview(address), { status: 404 });
  // AND the app gives no new address for it
  expectNoPreviewAddressToBeGiven(
    await app.user.triesToAskForPreviewAddressOf(session, "page.html"),
  );
});

test("one session's ticket cannot read another session's files", async () => {
  // ********************************************************************
  // ** GIVEN two sessions that each hold a page.html, and a secret file only in the second one
  // ********************************************************************
  const { app, address } = await startAppPreviewingGreetingPage();
  const second = await startsSessionThatFinished(app, "Another page");
  await app.user.writesFilesInTheWorktree(second, { "page.html": SECRET, "secret.html": SECRET });

  // ********************************************************************
  // ** WHEN the first session's ticket is used to ask for the secret file and for page.html
  // ********************************************************************
  const secret = await app.user.loadsPreviewNextTo(address, "secret.html");
  const page = await app.user.loadsPreview(address);

  // ********************************************************************
  // ** THEN the secret file is not found, and not shown
  // ********************************************************************
  expectPreviewToBeRefused(secret, { status: 404, leaking: SECRET });
  // AND page.html is the first session's own page, not the second one's
  expectPreviewToBeExactly(page, GREETING_PAGE);
});
