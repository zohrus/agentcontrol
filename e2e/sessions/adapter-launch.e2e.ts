import { afterEach, test } from "bun:test";
import {
  expectAdapterDownloadedTimes,
  expectAdapterInstalledWhole,
  expectAgentToHaveSaid,
} from "../support/expect/adapter-launch-expectations.ts";
import { expectTurnToEndWithStopReason } from "../support/expect/turn-expectations.ts";
import {
  aKilledRelayLeftAHalfMadeInstall,
  repoHoldsItsOwnBunConfigAndEnvFile,
  startRelayWithAdapterRegistry,
} from "../support/setup/adapter-registry.ts";
import { HELPER_PROGRAM_ADAPTER_SOURCE } from "../support/setup/mock-adapter-package.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

/** Names of the variables a shell command sees, if they are the relay's own or the session's ports. */
const PRINT_RELAY_VARIABLES =
  "env | cut -d= -f1 | grep -E '^(BUN_BE_BUN|BUN_INSTALL_CACHE_DIR|AGENTCONTROL_.*|PORT)$' | sort";
const ONLY_THE_SESSIONS_PORTS = ":\nAGENTCONTROL_PORT_BASE\nPORT\n";

/** A relay that runs with variables of its own, as the compiled relay does. */
const RELAY_VARIABLES = { BUN_BE_BUN: "1", BUN_INSTALL_CACHE_DIR: "/relay/cache" };

test("a command run by an agent started from a downloaded adapter sees the session's ports and none of the relay's variables", async () => {
  // ********************************************************************
  // ** GIVEN a relay with variables of its own, whose Claude Code adapter is not downloaded yet
  // ********************************************************************
  const relay = await startRelayWithAdapterRegistry({ env: RELAY_VARIABLES });
  // AND the agent will run a command that lists those variables
  relay.mockAgent.willRunCommand(PRINT_RELAY_VARIABLES);

  // ********************************************************************
  // ** WHEN the user starts a Claude Code session
  // ********************************************************************
  const session = await relay.startsClaudeCodeSession({ prompt: "Print the environment" });

  // ********************************************************************
  // ** THEN the command saw the session's port variables and none of the relay's
  // ********************************************************************
  await expectAgentToHaveSaid(relay, { session, text: ONLY_THE_SESSIONS_PORTS });
});

test("a command run by an agent that the adapter starts as a program of its own sees none of the relay's variables", async () => {
  // ********************************************************************
  // ** GIVEN a relay with variables of its own, and an adapter that starts its agent with its own runtime
  // ********************************************************************
  const relay = await startRelayWithAdapterRegistry({
    env: RELAY_VARIABLES,
    adapterSource: HELPER_PROGRAM_ADAPTER_SOURCE,
  });
  relay.mockAgent.willRunCommand(PRINT_RELAY_VARIABLES);

  // ********************************************************************
  // ** WHEN the user starts a Claude Code session
  // ********************************************************************
  const session = await relay.startsClaudeCodeSession({ prompt: "Print the environment" });

  // ********************************************************************
  // ** THEN the command saw the session's port variables and none of the relay's
  // ********************************************************************
  await expectAgentToHaveSaid(relay, { session, text: ONLY_THE_SESSIONS_PORTS });
});

test("an adapter does not run the Bun files of the repo it works in", async () => {
  // ********************************************************************
  // ** GIVEN a repo with its own bunfig.toml that preloads a script and a .env file
  // ********************************************************************
  const relay = await startRelayWithAdapterRegistry();
  await repoHoldsItsOwnBunConfigAndEnvFile(relay);
  relay.mockAgent.willRunCommand(
    'echo "env=${LEAKED-none} preloaded=$(ls preloaded 2>/dev/null || echo no)"',
  );

  // ********************************************************************
  // ** WHEN the user starts a Claude Code session on it
  // ********************************************************************
  const session = await relay.startsClaudeCodeSession({ prompt: "Print the environment" });

  // ********************************************************************
  // ** THEN the adapter neither ran the preload nor loaded the .env file
  // ********************************************************************
  await expectAgentToHaveSaid(relay, { session, text: ":\nenv=none preloaded=no\n" });
});

test("a command run by an agent started from a command override sees none of the relay's variables either", async () => {
  // ********************************************************************
  // ** GIVEN a relay with variables of its own, and an agent that runs a command listing them
  // ********************************************************************
  const relay = await startRelayWithLocalRepo({ env: RELAY_VARIABLES });
  relay.mockAgent.willRunCommand(PRINT_RELAY_VARIABLES);

  // ********************************************************************
  // ** WHEN the user starts a session
  // ********************************************************************
  const session = await relay.user.startsSession({ prompt: "Print the environment" });

  // ********************************************************************
  // ** THEN the command saw the session's port variables and none of the relay's
  // ********************************************************************
  await expectAgentToHaveSaid(relay, { session, text: ONLY_THE_SESSIONS_PORTS });
});

test("two sessions that start together download the adapter once", async () => {
  // ********************************************************************
  // ** GIVEN a relay whose Claude Code adapter is not downloaded yet and is slow to download
  // ********************************************************************
  const relay = await startRelayWithAdapterRegistry({ slowMs: 500 });

  // ********************************************************************
  // ** WHEN the user starts two Claude Code sessions at the same moment
  // ********************************************************************
  const [first, second] = await Promise.all([
    relay.startsClaudeCodeSession({ prompt: "First task" }),
    relay.startsClaudeCodeSession({ prompt: "Second task" }),
  ]);

  // ********************************************************************
  // ** THEN both agents ran their turn
  // ********************************************************************
  await expectTurnToEndWithStopReason(relay, { session: first, stopReason: "end_turn" });
  await expectTurnToEndWithStopReason(relay, { session: second, stopReason: "end_turn" });
  // AND the adapter was downloaded once and is installed whole
  expectAdapterDownloadedTimes(relay.registry, 1);
  expectAdapterInstalledWhole(relay);
});

test("the next download clears the half-made install that a killed relay left behind", async () => {
  // ********************************************************************
  // ** GIVEN a relay whose adapter folder holds a half-made install from a relay that was killed hours ago
  // ********************************************************************
  const relay = await startRelayWithAdapterRegistry();
  await aKilledRelayLeftAHalfMadeInstall(relay);

  // ********************************************************************
  // ** WHEN the user starts a Claude Code session, which downloads the adapter
  // ********************************************************************
  const session = await relay.startsClaudeCodeSession({ prompt: "First task" });

  // ********************************************************************
  // ** THEN its agent runs its turn
  // ********************************************************************
  await expectTurnToEndWithStopReason(relay, { session, stopReason: "end_turn" });
  // AND the adapter folder holds the adapter and nothing half made
  expectAdapterInstalledWhole(relay);
});

test("a session started after the adapter was downloaded needs no internet", async () => {
  // ********************************************************************
  // ** GIVEN a relay that downloaded the Claude Code adapter for one session, and then lost the internet
  // ********************************************************************
  const relay = await startRelayWithAdapterRegistry();
  const first = await relay.startsClaudeCodeSession({ prompt: "First task" });
  await expectTurnToEndWithStopReason(relay, { session: first, stopReason: "end_turn" });
  relay.registry.stop();

  // ********************************************************************
  // ** WHEN the user starts another Claude Code session
  // ********************************************************************
  const second = await relay.startsClaudeCodeSession({ prompt: "Second task" });

  // ********************************************************************
  // ** THEN its agent runs its turn
  // ********************************************************************
  await expectTurnToEndWithStopReason(relay, { session: second, stopReason: "end_turn" });
  // AND the adapter was downloaded only for the first
  expectAdapterDownloadedTimes(relay.registry, 1);
});
