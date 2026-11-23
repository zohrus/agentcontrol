import { afterEach, test } from "bun:test";
import {
  expectCrossOriginReadAllowed,
  expectPreviewToHoldNoSecret,
  expectSandboxedPageToGetItsFile,
  expectScriptNotToReadTheFile,
} from "../support/expect/preview-refusal-expectations.ts";
import { expectRequestRefusedAs } from "../support/expect/security-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { GREETING_PAGE } from "../support/setup/preview-pages.ts";
import { startAppPreviewingGreetingPage } from "../support/setup/preview-sessions.ts";

afterEach(cleanUpAfterTest);

test("a sandboxed page may load its scripts with CORS, but not read its data files", async () => {
  // ********************************************************************
  // ** GIVEN a previewed page next to a script and a data file
  // ********************************************************************
  const { app, session, address } = await startAppPreviewingGreetingPage();
  await app.user.writesFilesInTheWorktree(session, { "app.js": "export {};\n", "data.json": "{}" });

  // ********************************************************************
  // ** WHEN the page's sandbox asks for the script and for the data file
  // ********************************************************************
  const script = await app.user.asksForItsFileLikeASandboxedPage(address, "app.js");
  const data = await app.user.asksForItsFileLikeASandboxedPage(address, "data.json");

  // ********************************************************************
  // ** THEN the script comes with a CORS permission
  // ********************************************************************
  expectCrossOriginReadAllowed(script, true);
  // AND the data file does not
  expectCrossOriginReadAllowed(data, false);
});

test("a previewed page never contains the app's secret", async () => {
  // ********************************************************************
  // ** GIVEN a session whose worktree holds an HTML page
  // ********************************************************************
  const { app, address } = await startAppPreviewingGreetingPage();

  // ********************************************************************
  // ** WHEN the user loads the page's preview address
  // ********************************************************************
  const page = await app.user.loadsPreview(address);

  // ********************************************************************
  // ** THEN the page holds neither the secret nor the tag that carries it
  // ********************************************************************
  expectPreviewToHoldNoSecret(page, app.token);
});

test("a page that leaked its address cannot be read with fetch from another site", async () => {
  // ********************************************************************
  // ** GIVEN a previewed page whose address ended up on another website
  // ********************************************************************
  const { app, address } = await startAppPreviewingGreetingPage();

  // ********************************************************************
  // ** WHEN a script on that website reads the page's address with fetch
  // ********************************************************************
  const answer = await app.user.readsItsFileWithFetchLikeAnotherSite(address);

  // ********************************************************************
  // ** THEN the app refuses, and none of the file is shown
  // ********************************************************************
  expectScriptNotToReadTheFile(answer, "Hello from the agent");
});

test("a page in the sandbox gets its own files, but its request for the API is refused", async () => {
  // ********************************************************************
  // ** GIVEN a previewed page, whose requests come from a sandbox with an opaque origin
  // ********************************************************************
  const { app, address } = await startAppPreviewingGreetingPage();

  // ********************************************************************
  // ** WHEN the page asks for its own file and, from the same sandbox, for the session list
  // ********************************************************************
  const file = await app.user.asksForItsFileLikeASandboxedPage(address);
  const api = await app.user.reachesForTheApiLikeASandboxedPage();

  // ********************************************************************
  // ** THEN its own file comes back
  // ********************************************************************
  expectSandboxedPageToGetItsFile(file, GREETING_PAGE);
  // AND the API refuses the request as coming from another origin
  expectRequestRefusedAs(api, "forbidden-origin");
});
