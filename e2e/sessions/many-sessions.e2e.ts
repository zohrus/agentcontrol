import { afterEach, test } from "bun:test";
import { expectListToHoldRebuiltSessions } from "../support/expect/many-sessions-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { removeSessionLogs, writeLongSessionLogs } from "../support/setup/seeded-history.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

const SESSIONS = 50;
const EVENTS = 2000;

test("the relay rebuilds 50 long sessions from their logs after a restart and lists them without reading the logs again", async () => {
  // ********************************************************************
  // ** GIVEN 50 sessions of 2,000 events each in the relay's data folder, all waiting for approval
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  const ids = await writeLongSessionLogs(relay, { sessions: SESSIONS, eventCount: EVENTS });

  // ********************************************************************
  // ** WHEN the relay restarts, which ends their agents
  // ********************************************************************
  await relay.restartsTheRelay();

  // ********************************************************************
  // ** THEN the list holds all 50 sessions as failed, with no request nobody can answer
  // ********************************************************************
  await expectListToHoldRebuiltSessions(relay, { ids, eventCount: EVENTS });

  // ********************************************************************
  // ** WHEN the logs are deleted from under the running relay
  // ********************************************************************
  await removeSessionLogs(relay);

  // ********************************************************************
  // ** THEN the list is the same, because the relay answers from memory and does not read logs
  // ********************************************************************
  await expectListToHoldRebuiltSessions(relay, { ids, eventCount: EVENTS });
});
