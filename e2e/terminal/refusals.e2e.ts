import { rm } from "node:fs/promises";
import { afterEach, test } from "bun:test";
import { RelayName as N } from "@agentcontrol/protocol";
import {
  expectAtMostTerminals,
  expectRefusedBecauseArchived,
  expectRefusedBecauseNoShellCouldStart,
} from "../support/expect/terminal-refusal-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  opensTerminalsUntilRefused,
  triesToOpenATerminal,
} from "../support/setup/relay-terminals.ts";
import { worktreeOf } from "../support/setup/session-events.ts";
import { SHELL_RELAY_ENV } from "../support/setup/start-app-with-shell.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

async function aFinishedSession() {
  const relay = await startRelayWithLocalRepo({ env: SHELL_RELAY_ENV });
  const session = await relay.user.startsSession({ prompt: "Add rate limiting" });
  return { relay, session };
}

test("a terminal cannot be opened for an archived session", async () => {
  // ********************************************************************
  // ** GIVEN a session that was archived
  // ********************************************************************
  const { relay, session } = await aFinishedSession();
  await relay.call(N.sessionsArchive, { sessionId: session.id, force: true });

  // ********************************************************************
  // ** WHEN the user asks for its terminal
  // ********************************************************************
  const refusal = await triesToOpenATerminal(relay, session);

  // ********************************************************************
  // ** THEN the relay refuses it because the session was archived
  // ********************************************************************
  expectRefusedBecauseArchived(refusal);
});

test("one connection cannot hold more than eight terminals", async () => {
  // ********************************************************************
  // ** GIVEN a session
  // ********************************************************************
  const { relay, session } = await aFinishedSession();

  // ********************************************************************
  // ** WHEN terminals are opened one after another
  // ********************************************************************
  const result = await opensTerminalsUntilRefused(relay, session);

  // ********************************************************************
  // ** THEN the relay stops at eight and says at most eight can be open
  // ********************************************************************
  expectAtMostTerminals(result, 8);
});

test("a terminal for a session whose folder is gone says that no shell could start", async () => {
  // ********************************************************************
  // ** GIVEN a session whose worktree folder was deleted behind its back
  // ********************************************************************
  const { relay, session } = await aFinishedSession();
  await rm(await worktreeOf(relay, session), { recursive: true, force: true });

  // ********************************************************************
  // ** WHEN the user asks for its terminal
  // ********************************************************************
  const refusal = await triesToOpenATerminal(relay, session);

  // ********************************************************************
  // ** THEN the relay says it could not start a shell
  // ********************************************************************
  expectRefusedBecauseNoShellCouldStart(refusal);
});
