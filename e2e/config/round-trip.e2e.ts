import { afterEach, test } from "bun:test";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { expectEveryKindOfItemToBeImported } from "./support/expect/agent-expectations.ts";
import { startAppWithEveryKindOfItemApplied } from "./support/setup/config-fixtures.ts";

afterEach(cleanUpAfterTest);

test("importing what the app itself applied returns every kind of item again", async () => {
  // ********************************************************************
  // ** GIVEN every kind of item set up in the app and applied to both agents
  // ********************************************************************
  const app = await startAppWithEveryKindOfItemApplied();

  // ********************************************************************
  // ** WHEN the user imports the existing setup
  // ********************************************************************
  const items = await app.user.importsTheExistingSetup();

  // ********************************************************************
  // ** THEN every kind of item comes back, the hook and instruction under the ids the app gave them
  // ********************************************************************
  expectEveryKindOfItemToBeImported(items);
});
