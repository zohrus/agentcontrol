import { afterEach, test } from "bun:test";
import {
  expectAppToAnswerAgain,
  expectAppToHaveFailedToReconnect,
  expectAppToSayTheRelayIsUnavailable,
} from "../support/expect/app-outage-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("while the relay is down the app says it is unavailable, and recovers when it is back", async () => {
  // ********************************************************************
  // ** GIVEN a running app whose relay has just stopped
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  await app.theRelayStops();
  await expectAppToSayTheRelayIsUnavailable(app);
  // AND the app has tried to reconnect at least once while the relay was down
  await expectAppToHaveFailedToReconnect(app);

  // ********************************************************************
  // ** WHEN the relay starts again
  // ********************************************************************
  await app.theRelayStartsAgain();

  // ********************************************************************
  // ** THEN the app finds it and answers requests that need it again
  // ********************************************************************
  await expectAppToAnswerAgain(app);
});
