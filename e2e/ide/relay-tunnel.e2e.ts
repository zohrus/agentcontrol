import { afterEach, setDefaultTimeout, test } from "bun:test";
import { expectCodeServerToBeGone } from "../support/expect/ide-process-expectations.ts";
import {
  expectCodeServerRunning,
  expectRelayToRefuse,
} from "../support/expect/ide-relay-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { FAKE_CODE_SERVER_ENV, NO_CODE_SERVER_ENV } from "../support/setup/ide-setups.ts";
import { codeServersStartedBy } from "../support/setup/ide-user.ts";
import {
  opensSocketUnderUsedId,
  REFUSED_AS_INVALID,
  REFUSED_AS_NOT_INSTALLED,
  sendsIntoSocketOf,
  startsCodeServer,
  startsRelayWithAnOpenSocket,
  stopsCodeServer,
} from "../support/setup/relay-ide.ts";
import { anotherProgramOf } from "../support/setup/relay-terminals.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

setDefaultTimeout(30_000);
afterEach(cleanUpAfterTest);

test("another program connected to the relay cannot send into a WebSocket it did not open", async () => {
  // ********************************************************************
  // ** GIVEN a session whose WebSocket into code-server was opened by the app
  // ********************************************************************
  const { relay } = await startsRelayWithAnOpenSocket();

  // ********************************************************************
  // ** WHEN another program that knows its id sends into it
  // ********************************************************************
  const answer = await sendsIntoSocketOf(anotherProgramOf(relay), "mine");

  // ********************************************************************
  // ** THEN the relay refuses as if there were no such socket
  // ********************************************************************
  expectRelayToRefuse(answer, REFUSED_AS_INVALID);
});

test("a tunnel id that is in use cannot be opened again", async () => {
  // ********************************************************************
  // ** GIVEN a session whose WebSocket into code-server is open under the id "mine"
  // ********************************************************************
  const { relay, session } = await startsRelayWithAnOpenSocket();

  // ********************************************************************
  // ** WHEN another WebSocket is opened under the same id
  // ********************************************************************
  const answer = await opensSocketUnderUsedId(relay, { session, tunnelId: "mine" });

  // ********************************************************************
  // ** THEN the relay refuses it
  // ********************************************************************
  expectRelayToRefuse(answer, REFUSED_AS_INVALID);
});

test("asking the relay to stop a session's code-server ends it", async () => {
  // ********************************************************************
  // ** GIVEN a code-server the relay started for a session
  // ********************************************************************
  const relay = await startRelayWithLocalRepo({ env: FAKE_CODE_SERVER_ENV });
  const session = await relay.user.startsSession({ prompt: "Add rate limiting" });
  await startsCodeServer(relay, session);
  await expectCodeServerRunning(relay, session, true);

  // ********************************************************************
  // ** WHEN the app asks the relay to stop it
  // ********************************************************************
  await stopsCodeServer(relay, session);

  // ********************************************************************
  // ** THEN the relay says none runs, and the process is gone
  // ********************************************************************
  await expectCodeServerRunning(relay, session, false);
  const [started] = await codeServersStartedBy(relay.dataDir);
  await expectCodeServerToBeGone(started as NonNullable<typeof started>);
});

test("starting a code-server on a machine without one is refused as not installed", async () => {
  // ********************************************************************
  // ** GIVEN a relay on a machine without code-server
  // ********************************************************************
  const relay = await startRelayWithLocalRepo({ env: NO_CODE_SERVER_ENV });
  const session = await relay.user.startsSession({ prompt: "Add rate limiting" });

  // ********************************************************************
  // ** WHEN the app asks the relay to start one
  // ********************************************************************
  const answer = await startsCodeServer(relay, session);

  // ********************************************************************
  // ** THEN the relay refuses with the "not installed" code
  // ********************************************************************
  expectRelayToRefuse(answer, REFUSED_AS_NOT_INSTALLED);
});
