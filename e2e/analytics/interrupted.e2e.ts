import { afterEach, test } from "bun:test";
import { expectSessionNotToHaveWaitedWhileInterrupted } from "../support/expect/analytics-interrupted-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWhoseRelayDiedAnHourAgoWithARequestWaiting } from "../support/setup/interrupted-analytics.ts";

afterEach(cleanUpAfterTest);

test("the hour a relay was down is not counted as time the session waited for permission", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent asked for permission an hour ago, when the relay died
  // ********************************************************************
  const title = "Run the tests";

  // ********************************************************************
  // ** WHEN the relay starts again and the app reads it
  // ********************************************************************
  const app = await startAppWhoseRelayDiedAnHourAgoWithARequestWaiting(title);

  // ********************************************************************
  // ** THEN the analytics count at most a minute of waiting for that session
  // ********************************************************************
  await expectSessionNotToHaveWaitedWhileInterrupted(app, title);
});
