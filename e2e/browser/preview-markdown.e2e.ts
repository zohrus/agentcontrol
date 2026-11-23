import { afterEach, test } from "bun:test";
import {
  expectPreviewHeadingToRead,
  expectPreviewLinkToOpenInANewTab,
  expectPreviewLinkToStayInTheDocument,
  expectPreviewToExplain,
  expectPreviewToHoldNothingThatRuns,
  expectPreviewToShowCodeBlockWith,
  expectPreviewToShowItsImage,
  expectPreviewToShowTableWith,
} from "../support/browser/preview-browser-expectations.ts";
import {
  approvesTheWriteAndWaitsForTheAgent,
  opensPreviewOfFileTheAgentWrote,
} from "../support/browser/preview-setups.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { HOSTILE_NOTES, PIXEL_PNG, RELEASE_NOTES } from "../support/setup/preview-pages.ts";

afterEach(cleanUpAfterTest);

test(
  "a Markdown file is previewed as a document with its heading, table and code block",
  async () => {
    // ********************************************************************
    // ** GIVEN the agent writes notes.md with a heading, a table and a code block
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willWriteFile("notes.md", RELEASE_NOTES);

    // ********************************************************************
    // ** WHEN the user previews notes.md
    // ********************************************************************
    await opensPreviewOfFileTheAgentWrote(app, "notes.md");

    // ********************************************************************
    // ** THEN the preview shows the heading
    // ********************************************************************
    await expectPreviewHeadingToRead(app, "Release notes");
    // AND the table
    await expectPreviewToShowTableWith(app, "apples");
    // AND the code block
    await expectPreviewToShowCodeBlockWith(app, "const answer = 42;");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a script in a Markdown file does not run and is not even left in the preview",
  async () => {
    // ********************************************************************
    // ** GIVEN the agent writes notes.md holding a script element and an image with an error handler
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willWriteFile("notes.md", HOSTILE_NOTES);

    // ********************************************************************
    // ** WHEN the user previews notes.md
    // ********************************************************************
    await opensPreviewOfFileTheAgentWrote(app, "notes.md");

    // ********************************************************************
    // ** THEN the harmless heading is shown
    // ********************************************************************
    await expectPreviewHeadingToRead(app, "Harmless heading");
    // AND no script and no event handler is left in the document
    await expectPreviewToHoldNothingThatRuns(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "an image next to a Markdown file shows in its preview",
  async () => {
    // ********************************************************************
    // ** GIVEN the agent wrote notes.md that shows logo.png, which sits next to it
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willWriteFile("notes.md", "# With a picture\n\n![logo](logo.png)\n");
    const session = await app.user.startsSession({ prompt: "Write the notes" });
    await approvesTheWriteAndWaitsForTheAgent(app, session);
    await app.user.writesFilesInTheWorktree(session, { "logo.png": PIXEL_PNG });

    // ********************************************************************
    // ** WHEN the user previews notes.md
    // ********************************************************************
    await app.page.opensSession(session.title);
    await app.page.previewsFileFromTheList("notes.md");

    // ********************************************************************
    // ** THEN the picture is shown
    // ********************************************************************
    await expectPreviewToShowItsImage(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "links in a Markdown file open in a new tab, except links to a section of the same file",
  async () => {
    // ********************************************************************
    // ** GIVEN the agent writes notes.md with a link to a website and a link to its own section
    // ********************************************************************
    const app = await startAppInBrowser();
    const notes = "# Notes\n\n[the site](https://example.com/) and [Install](#install)\n";
    app.mockAgent.willWriteFile("notes.md", notes);

    // ********************************************************************
    // ** WHEN the user previews notes.md
    // ********************************************************************
    await opensPreviewOfFileTheAgentWrote(app, "notes.md");
    await expectPreviewHeadingToRead(app, "Notes");

    // ********************************************************************
    // ** THEN the link to the website opens in a new tab that cannot reach back
    // ********************************************************************
    await expectPreviewLinkToOpenInANewTab(app, "the site");
    // AND the link to the section stays in the document
    await expectPreviewLinkToStayInTheDocument(app, "Install");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the Preview tab says plainly when the selected file is not a page",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose agent wrote notes.txt, open in the browser
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willWriteFile("notes.txt", "just text\n");
    const session = await app.user.startsSession({ prompt: "Write the notes" });
    await approvesTheWriteAndWaitsForTheAgent(app, session);
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** WHEN the user opens the Preview tab
    // ********************************************************************
    await app.page.opensPreviewTab();

    // ********************************************************************
    // ** THEN it says that notes.txt cannot be previewed
    // ********************************************************************
    await expectPreviewToExplain(app, "notes.txt is not an HTML or Markdown file");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
