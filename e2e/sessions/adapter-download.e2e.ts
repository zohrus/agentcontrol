import { afterEach, test } from "bun:test";
import {
  expectAdaptersKeptInTheRelayFolder,
  expectSessionNotToMention,
  expectSessionToTellTheUser,
} from "../support/expect/adapter-expectations.ts";
import { expectNothingInstalled } from "../support/expect/adapter-launch-expectations.ts";
import { expectTurnToEndWithStopReason } from "../support/expect/turn-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  startRelayWithoutInternet,
  startRelayWithoutInternetAfterAdapterDownload,
} from "../support/setup/offline-relay.ts";

afterEach(cleanUpAfterTest);

test("a Claude Code session says it is downloading the adapter the first time", async () => {
  // ********************************************************************
  // ** GIVEN the relay is running and the Claude Code adapter was never downloaded
  // ********************************************************************
  const relay = await startRelayWithoutInternet();

  // ********************************************************************
  // ** WHEN the user starts a Claude Code session
  // ********************************************************************
  const session = await relay.startsClaudeCodeSession({ prompt: "Add rate limiting" });

  // ********************************************************************
  // ** THEN the session says that the adapter is being downloaded
  // ********************************************************************
  await expectSessionToTellTheUser(relay, { session, text: "Downloading the Claude Code adapter" });
});

test("without internet the first Claude Code session says to check the connection", async () => {
  // ********************************************************************
  // ** GIVEN the relay is running with no internet and no adapter downloaded
  // ********************************************************************
  const relay = await startRelayWithoutInternet();

  // ********************************************************************
  // ** WHEN the user starts a Claude Code session
  // ********************************************************************
  const session = await relay.startsClaudeCodeSession({ prompt: "Add rate limiting" });

  // ********************************************************************
  // ** THEN the session says the download failed and to check the internet connection
  // ********************************************************************
  await expectSessionToTellTheUser(relay, {
    session,
    text: "adapter has not been downloaded yet and could not start. Check your internet connection",
  });
  // AND the relay keeps its downloads in its own folder, with nothing half installed in it
  expectAdaptersKeptInTheRelayFolder(relay);
  expectNothingInstalled(relay);
});

test("a Claude Code session does not mention a download when the adapter is already there", async () => {
  // ********************************************************************
  // ** GIVEN the relay is running and the Claude Code adapter was downloaded earlier
  // ********************************************************************
  const relay = await startRelayWithoutInternetAfterAdapterDownload();

  // ********************************************************************
  // ** WHEN the user starts a Claude Code session
  // ********************************************************************
  const session = await relay.startsClaudeCodeSession({ prompt: "Add rate limiting" });

  // ********************************************************************
  // ** THEN its agent runs its turn, and the session never says that it downloads anything
  // ********************************************************************
  await expectTurnToEndWithStopReason(relay, { session, stopReason: "end_turn" });
  expectSessionNotToMention(relay, { session, text: "Downloading" });
});
