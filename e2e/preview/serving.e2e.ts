import { afterEach, test } from "bun:test";
import {
  expectPreviewToBeExactly,
  expectPreviewToBeFencedIn,
  expectPreviewToBeInertToTheBrowser,
  expectPreviewToLoadOnlyFromItsOwnFolder,
  expectPreviewToServe,
} from "../support/expect/preview-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  GREETING_PAGE,
  PIXEL_PNG,
  SITE_PAGE,
  SITE_SCRIPT,
  SITE_STYLE,
} from "../support/setup/preview-pages.ts";
import {
  startAppPreviewingGreetingPage,
  startAppWithSessionHolding,
} from "../support/setup/preview-sessions.ts";

afterEach(cleanUpAfterTest);

test("a previewed HTML file is served exactly as written, with no token and no app code added", async () => {
  // ********************************************************************
  // ** GIVEN a session whose worktree holds an HTML page
  // ********************************************************************
  const { app, address } = await startAppPreviewingGreetingPage();

  // ********************************************************************
  // ** WHEN the user loads the page's preview address
  // ********************************************************************
  const page = await app.user.loadsPreview(address);

  // ********************************************************************
  // ** THEN the page is exactly the file, with nothing injected
  // ********************************************************************
  expectPreviewToBeExactly(page, GREETING_PAGE);
});

test("a previewed page is fenced in by a sandbox policy that gives it no network and no way into the app", async () => {
  // ********************************************************************
  // ** GIVEN a session whose worktree holds an HTML page
  // ********************************************************************
  const { app, address } = await startAppPreviewingGreetingPage();

  // ********************************************************************
  // ** WHEN the user loads the page's preview address
  // ********************************************************************
  const page = await app.user.loadsPreview(address);

  // ********************************************************************
  // ** THEN the page is sandboxed with its own origin and cannot make requests
  // ********************************************************************
  expectPreviewToBeFencedIn(page);
  // AND it may load things only from its own folder of the preview, not from the rest of the app
  expectPreviewToLoadOnlyFromItsOwnFolder(page);
  // AND the browser is told not to cache it or guess its type
  expectPreviewToBeInertToTheBrowser(page);
});

test("a page's stylesheet, script and image in the same folder load with their content types", async () => {
  // ********************************************************************
  // ** GIVEN a session whose worktree holds a page with its own stylesheet, script and image
  // ********************************************************************
  const { app, session } = await startAppWithSessionHolding({
    "site/index.html": SITE_PAGE,
    "site/style.css": SITE_STYLE,
    "site/app.js": SITE_SCRIPT,
    "site/logo.png": PIXEL_PNG,
  });

  // ********************************************************************
  // ** WHEN the page's files are loaded through its preview address, the way a browser would
  // ********************************************************************
  const address = await app.user.asksForPreviewAddressOf(session, "site/index.html");
  const style = await app.user.loadsPreviewNextTo(address, "style.css");
  const script = await app.user.loadsPreviewNextTo(address, "app.js");
  const logo = await app.user.loadsPreviewNextTo(address, "logo.png");

  // ********************************************************************
  // ** THEN each file comes back as it is, as the right kind of file
  // ********************************************************************
  const text = (content: string) => new TextEncoder().encode(content);
  expectPreviewToServe(style, { contentType: "text/css", bytes: text(SITE_STYLE) });
  expectPreviewToServe(script, { contentType: "text/javascript", bytes: text(SITE_SCRIPT) });
  // AND the image is not damaged on the way
  expectPreviewToServe(logo, { contentType: "image/png", bytes: PIXEL_PNG });
});

test("a folder address shows the folder's index.html", async () => {
  // ********************************************************************
  // ** GIVEN a session whose worktree holds site/index.html
  // ********************************************************************
  const { app, session } = await startAppWithSessionHolding({ "site/index.html": SITE_PAGE });

  // ********************************************************************
  // ** WHEN the user loads the address of the site folder itself
  // ********************************************************************
  const address = await app.user.asksForPreviewAddressOf(session, "site/index.html");
  const folder = await app.user.loadsPreviewNextTo(address, "./");

  // ********************************************************************
  // ** THEN the page of that folder is shown
  // ********************************************************************
  expectPreviewToBeExactly(folder, SITE_PAGE);
});

test("an address without the slash after the ticket is sent on to the folder's index.html", async () => {
  // ********************************************************************
  // ** GIVEN a session whose worktree holds index.html at the top
  // ********************************************************************
  const { app, session } = await startAppWithSessionHolding({ "index.html": SITE_PAGE });
  const address = await app.user.asksForPreviewAddressOf(session, "index.html");

  // ********************************************************************
  // ** WHEN the user loads the ticket's address with the closing slash missing
  // ********************************************************************
  const page = await app.user.loadsPreviewTopFolderWithoutSlash(address);

  // ********************************************************************
  // ** THEN the page is shown, from the address with the slash, so its relative links work
  // ********************************************************************
  expectPreviewToBeExactly(page, SITE_PAGE);
});
