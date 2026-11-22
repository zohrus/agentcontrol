import { afterEach, test } from "bun:test";
import {
  expectAddressNotToBeTheUi,
  expectAddressToServeFile,
  expectAddressToServeTheUi,
} from "../support/expect/ui-serving-expectations.ts";
import { startsAppServingBuiltUi } from "../support/setup/built-ui.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test("an app serving a built UI answers the root and any app address with the UI page", async () => {
  // ********************************************************************
  // ** GIVEN the app is serving a folder of built UI files
  // ********************************************************************
  const app = await startsAppServingBuiltUi();

  // ********************************************************************
  // ** WHEN the browser asks for the root and for an address like a session link
  // ********************************************************************
  // ********************************************************************
  // ** THEN both are answered with the UI page
  // ********************************************************************
  await expectAddressToServeTheUi(app.baseUrl, "/");
  await expectAddressToServeTheUi(app.baseUrl, "/sessions/abc");
  // AND so is an address whose last part has a dot and digits
  await expectAddressToServeTheUi(app.baseUrl, "/sessions/ses_1.2");
});

test("an app serving a built UI serves a script of the build as it is", async () => {
  // ********************************************************************
  // ** GIVEN the app is serving a folder of built UI files with an app.js
  // ********************************************************************
  const app = await startsAppServingBuiltUi();

  // ********************************************************************
  // ** WHEN the browser asks for /app.js
  // ********************************************************************
  // ********************************************************************
  // ** THEN the file is served unchanged
  // ********************************************************************
  await expectAddressToServeFile({
    baseUrl: app.baseUrl,
    path: "/app.js",
    content: "console.log('app');",
  });
});

test("an app serving a built UI does not answer a missing file, an unknown API path or /_safe with the UI page", async () => {
  // ********************************************************************
  // ** GIVEN the app is serving a folder of built UI files
  // ********************************************************************
  const app = await startsAppServingBuiltUi();

  // ********************************************************************
  // ** WHEN the browser asks for a missing script, an unknown API path and the reserved /_safe
  // ********************************************************************
  // ********************************************************************
  // ** THEN each is answered with 404 and not the UI page
  // ********************************************************************
  await expectAddressNotToBeTheUi(app.baseUrl, "/missing.js");
  await expectAddressNotToBeTheUi(app.baseUrl, "/api/nope");
  await expectAddressNotToBeTheUi(app.baseUrl, "/_safe");
});
