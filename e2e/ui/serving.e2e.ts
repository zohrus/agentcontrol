import { afterEach, test } from "bun:test";
import {
  expectAddressNotToBeTheUi,
  expectAddressToServeFile,
  expectAddressToServeTheUi,
} from "../support/expect/ui-serving-expectations.ts";
import { createBuiltUiFolder } from "../support/setup/built-ui.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("the app serves a built UI, with its page for any app address but not for the API or /_safe", async () => {
  // ********************************************************************
  // ** GIVEN a folder of built UI files
  // ********************************************************************
  const folder = await createBuiltUiFolder();

  // ********************************************************************
  // ** WHEN the app is started to serve that folder
  // ********************************************************************
  const app = await startAppWithLocalWorkspace({ uiDist: folder });

  // ********************************************************************
  // ** THEN the root and an address like a session link serve the UI page
  // ********************************************************************
  await expectAddressToServeTheUi(app.baseUrl, "/");
  await expectAddressToServeTheUi(app.baseUrl, "/sessions/abc");
  // AND a script of the build is served as it is
  await expectAddressToServeFile({
    baseUrl: app.baseUrl,
    path: "/app.js",
    content: "console.log('app');",
  });
  // AND a missing file, an unknown API path and the reserved /_safe are not the UI
  await expectAddressNotToBeTheUi(app.baseUrl, "/missing.js");
  await expectAddressNotToBeTheUi(app.baseUrl, "/api/nope");
  await expectAddressNotToBeTheUi(app.baseUrl, "/_safe");
});
