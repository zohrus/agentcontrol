import { afterEach, test } from "bun:test";
import { expectAppToRefuse } from "../support/expect/app-refusal-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  triesToAddARepoWithABodyThatIsNotJson,
  triesToListAgentsThroughAFailingProxy,
} from "../support/setup/odd-requests.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("a request whose body is not JSON is refused as invalid", async () => {
  // ********************************************************************
  // ** GIVEN a running app
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN a client adds a repo with a body that is not JSON
  // ********************************************************************
  const outcome = await triesToAddARepoWithABodyThatIsNotJson(app);

  // ********************************************************************
  // ** THEN the app refuses it as an invalid request
  // ********************************************************************
  expectAppToRefuse(outcome, { status: 400, code: "invalid-request" });
});

test("an error page that is not the app's own reads as an unknown refusal with its status", async () => {
  // ********************************************************************
  // ** GIVEN a running app and a proxy in front of it that answers 502 with plain text
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN a client lists the agents through that proxy
  // ********************************************************************
  const outcome = await triesToListAgentsThroughAFailingProxy(app);

  // ********************************************************************
  // ** THEN the client reports the status with the code "unknown"
  // ********************************************************************
  expectAppToRefuse(outcome, { status: 502, code: "unknown" });
});
