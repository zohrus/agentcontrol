// The smoke step that installs an agent adapter with the compiled app's own runtime and runs it. The
// registry is on this machine and the adapter's program is the mock agent, so no real registry is
// needed; the real adapters were checked by hand (see docs/decisions/2026-11-23-adapter-launch.md).
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { SmokeApp } from "./app-process.ts";
import { expect } from "./check.ts";
import { runsAMockSession } from "./session-steps.ts";

/** Prints the names of the relay's own variables, and of the session's ports, as the agent sees them. */
const PRINT_VARIABLES =
  "env | cut -d= -f1 | grep -E '^(BUN_BE_BUN|BUN_INSTALL_CACHE_DIR|AGENTCONTROL_.*|PORT)$' | sort";
const ONLY_THE_SESSIONS_PORTS = ":\nAGENTCONTROL_PORT_BASE\nPORT\n";

interface Update {
  type: string;
  text?: string;
}

function saidBy(events: { kind: string; payload?: unknown }[]): string {
  const payloads = events.filter((event) => event.kind === "acp").map((event) => event.payload);
  const updates = payloads.flatMap((payload) => (payload as { updates?: Update[] }).updates ?? []);
  return updates
    .map((update) => (update.type === "agent-text" ? (update.text ?? "") : ""))
    .join("");
}

export async function adapterRunsWithACleanEnvironment(app: SmokeApp): Promise<void> {
  const command = { kind: "runCommand", command: PRINT_VARIABLES };
  const { events } = await runsAMockSession(app, { agent: "claude-code", steps: [command] });
  const adapter = join(app.dataDir, "relay", "adapters", "claude-agent-acp@0.109.1");
  expect(existsSync(adapter), `the adapter was not installed in ${adapter}`);
  const said = saidBy(events);
  expect(
    said.includes(ONLY_THE_SESSIONS_PORTS),
    `a command the agent ran saw these variables: ${JSON.stringify(said)}`,
  );
}
