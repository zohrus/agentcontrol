import { afterEach, test } from "bun:test";
import {
  expectRequestRefusedAs,
  expectSocketClosedAsPolicyViolation,
} from "../support/expect/security-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithASession } from "../support/setup/start-app-with-shell.ts";
import { terminalOutsidersOf } from "../support/setup/terminal-outsiders.ts";

afterEach(cleanUpAfterTest);

test("a website cannot open a terminal, even one that knows the secret", async () => {
  // ********************************************************************
  // ** GIVEN a session of the running app
  // ********************************************************************
  const { app, session } = await startAppWithASession();

  // ********************************************************************
  // ** WHEN a page on another website asks for a terminal, offering the secret
  // ********************************************************************
  const answer = await terminalOutsidersOf(app).aWebsiteTriesToOpenATerminal(session);

  // ********************************************************************
  // ** THEN the app refuses it as coming from another origin
  // ********************************************************************
  expectRequestRefusedAs(answer, "forbidden-origin");
});

test("a program that offers no secret cannot open a terminal", async () => {
  // ********************************************************************
  // ** GIVEN a session of the running app
  // ********************************************************************
  const { app, session } = await startAppWithASession();

  // ********************************************************************
  // ** WHEN a program with no secret asks for a terminal
  // ********************************************************************
  const answer =
    await terminalOutsidersOf(app).aProgramWithoutTheTokenTriesToOpenATerminal(session);

  // ********************************************************************
  // ** THEN the app refuses it as unauthorised
  // ********************************************************************
  expectRequestRefusedAs(answer, "unauthorized");
});

test("a wrong secret, or the secret in the address, does not open a terminal", async () => {
  // ********************************************************************
  // ** GIVEN a session of the running app
  // ********************************************************************
  const { app, session } = await startAppWithASession();
  const outsiders = terminalOutsidersOf(app);

  // ********************************************************************
  // ** WHEN programs ask with a wrong secret, and with the secret in the address
  // ********************************************************************
  const wrong = await outsiders.aProgramWithAWrongTokenTriesToOpenATerminal(session);
  const inAddress = await outsiders.aProgramWithTheSecretInTheAddressTriesToOpenATerminal(session);

  // ********************************************************************
  // ** THEN the app refuses both as unauthorised
  // ********************************************************************
  expectRequestRefusedAs(wrong, "unauthorized");
  expectRequestRefusedAs(inAddress, "unauthorized");
});

test("the terminal address answers only a WebSocket request", async () => {
  // ********************************************************************
  // ** GIVEN a session of the running app
  // ********************************************************************
  const { app, session } = await startAppWithASession();

  // ********************************************************************
  // ** WHEN a program that holds the secret asks with a plain request
  // ********************************************************************
  const answer = await terminalOutsidersOf(app).aProgramWithTheSecretAsksWithAPlainRequest(session);

  // ********************************************************************
  // ** THEN the app says a WebSocket is required
  // ********************************************************************
  expectRequestRefusedAs(answer, "upgrade-required");
});

test("the terminal of an archived session is refused as archived", async () => {
  // ********************************************************************
  // ** GIVEN a session that was archived
  // ********************************************************************
  const { app, session } = await startAppWithASession();
  await app.user.archivesSession(session, { force: true });

  // ********************************************************************
  // ** WHEN a program that holds the secret asks for its terminal
  // ********************************************************************
  const answer = await terminalOutsidersOf(app).aProgramWithTheSecretAsksForTheTerminalOf(session);

  // ********************************************************************
  // ** THEN the app refuses it because the session was archived
  // ********************************************************************
  expectRequestRefusedAs(answer, "session-archived");
});

test("text that is not a terminal message ends the socket as a policy violation", async () => {
  // ********************************************************************
  // ** GIVEN a session of the running app
  // ********************************************************************
  const { app, session } = await startAppWithASession();

  // ********************************************************************
  // ** WHEN a program with the secret sends the socket text that is no message
  // ********************************************************************
  const code = await terminalOutsidersOf(app).aProgramWithTheSecretSendsGarbage(session);

  // ********************************************************************
  // ** THEN the app closes the socket with the policy-violation code 1008
  // ********************************************************************
  expectSocketClosedAsPolicyViolation(code);
});
