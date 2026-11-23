import { afterEach, test } from "bun:test";
import {
  expectPreviewFrameToBeSandboxedWith,
  expectPreviewHeadingToRead,
  expectPreviewToHaveBeenLoadedAgain,
  expectPreviewScriptNotToHaveReachedTheApi,
  expectPreviewScriptToHaveReported,
  expectTheAppPageNotToHaveReloaded,
} from "../support/browser/preview-browser-expectations.ts";
import {
  approvesTheWriteAndWaitsForTheAgent,
  opensPreviewOfFileTheAgentWrote,
} from "../support/browser/preview-setups.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { expectPreviewToBeFencedIn } from "../support/expect/preview-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { API_PROBING_PAGE, GREETING_PAGE, pageSaying } from "../support/setup/preview-pages.ts";

afterEach(cleanUpAfterTest);

test(
  "the Preview tab shows a page the agent wrote, and the page's own script runs",
  async () => {
    // ********************************************************************
    // ** GIVEN the app is open in a browser, and the agent writes page.html with a script in it
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willWriteFile("page.html", GREETING_PAGE);

    // ********************************************************************
    // ** WHEN the user previews page.html from the Changes list
    // ********************************************************************
    await opensPreviewOfFileTheAgentWrote(app, "page.html");

    // ********************************************************************
    // ** THEN the preview shows the heading that the page's script wrote
    // ********************************************************************
    await expectPreviewHeadingToRead(app, "Hello from the agent");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the preview updates by itself after the agent edits the file",
  async () => {
    // ********************************************************************
    // ** GIVEN the agent wrote a page saying "Version one" and the user is previewing it
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willWriteFile("page.html", pageSaying("Version one"));
    // AND on its next turn the agent will rewrite the page to say "Version two"
    app.mockAgent.onNextPrompt();
    app.mockAgent.willWriteFile("page.html", pageSaying("Version two"));
    const session = await opensPreviewOfFileTheAgentWrote(app, "page.html");
    await expectPreviewHeadingToRead(app, "Version one");
    await app.page.marksTheAppPage();

    // ********************************************************************
    // ** WHEN the user asks for the change and approves the agent's write
    // ********************************************************************
    await app.user.sendsMessage(session, "Say version two");
    await approvesTheWriteAndWaitsForTheAgent(app, session);

    // ********************************************************************
    // ** THEN the preview now shows "Version two", though the user reloaded nothing
    // ********************************************************************
    await expectPreviewHeadingToRead(app, "Version two");
    await expectTheAppPageNotToHaveReloaded(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the previewed page sits in a sandboxed frame and can be opened on its own, still sandboxed",
  async () => {
    // ********************************************************************
    // ** GIVEN the agent wrote page.html and the user is previewing it
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willWriteFile("page.html", GREETING_PAGE);
    await opensPreviewOfFileTheAgentWrote(app, "page.html");

    // ********************************************************************
    // ** WHEN the user looks at the frame and at the address behind Open in new tab
    // ********************************************************************
    const address = await app.page.previewOpenAddress();

    // ********************************************************************
    // ** THEN the frame is sandboxed with scripts and forms only
    // ********************************************************************
    await expectPreviewFrameToBeSandboxedWith(app, "allow-scripts allow-forms");
    // AND the address opened on its own comes with the sandbox policy too
    expectPreviewToBeFencedIn(await app.user.loadsPreview(address));
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "Reload shows the page again from a fresh address",
  async () => {
    // ********************************************************************
    // ** GIVEN the agent wrote page.html and the user is previewing it
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willWriteFile("page.html", GREETING_PAGE);
    await opensPreviewOfFileTheAgentWrote(app, "page.html");
    const before = await app.page.previewOpenAddress();

    // ********************************************************************
    // ** WHEN the user presses Reload
    // ********************************************************************
    await app.page.reloadsThePreview();

    // ********************************************************************
    // ** THEN the page is loaded again from a new address, and still shows its heading
    // ********************************************************************
    await expectPreviewToHaveBeenLoadedAgain(app, before);
    await expectPreviewHeadingToRead(app, "Hello from the agent");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a script in the previewed page cannot reach the app's API",
  async () => {
    // ********************************************************************
    // ** GIVEN a page whose script calls fetch("/api/sessions") and writes the outcome into the page
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willWriteFile("probe.html", API_PROBING_PAGE);

    // ********************************************************************
    // ** WHEN the user previews it
    // ********************************************************************
    await opensPreviewOfFileTheAgentWrote(app, "probe.html");

    // ********************************************************************
    // ** THEN the page reports that the request was blocked
    // ********************************************************************
    await expectPreviewScriptToHaveReported(app, "blocked: TypeError");
    // AND it never reached the API
    await expectPreviewScriptNotToHaveReachedTheApi(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);
