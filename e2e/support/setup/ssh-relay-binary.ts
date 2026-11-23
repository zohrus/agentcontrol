import { chmod } from "node:fs/promises";
import { join } from "node:path";

const relayMain = join(import.meta.dir, "../../../packages/relay/src/main.ts");
const mockAgentMain = join(import.meta.dir, "../mock-agent/main.ts");

const quoted = (text: string): string => `'${text.replaceAll("'", `'\\''`)}'`;

/** What a relay "binary" on the host must know: where its home is and which agent it runs. */
export interface RelayBinarySpec {
  /** Where the file is written. */
  path: string;
  /** The home folder of the host's relay: its agent settings and git identity live there. */
  home: string;
  /** The mock agent's script (every agent kind runs the mock agent, so the handshakes pass). */
  mockAgentScript: string;
  /** The command that starts Claude Code, when it is not the mock agent by its absolute path. */
  claudeCommand?: string[];
  /** Makes the relay report this version instead of the app's, to look like an older release. */
  version?: string;
}

/**
 * Writes an executable that runs the relay from this checkout the way the compiled binary would:
 * `<binary> --stdio --data-dir <dir>`. Release builds are compiled with `bun run build`; tests use
 * a script so no compile is needed.
 */
export async function writeRelayBinary(spec: RelayBinarySpec): Promise<void> {
  const mockCommand = JSON.stringify([process.execPath, mockAgentMain]);
  const lines = [
    "#!/bin/sh",
    `export HOME=${quoted(spec.home)}`,
    `export AGENTCONTROL_AGENT_MOCK_CMD=${quoted(mockCommand)}`,
    `export AGENTCONTROL_AGENT_CLAUDE_CODE_CMD=${quoted(spec.claudeCommand ? JSON.stringify(spec.claudeCommand) : mockCommand)}`,
    `export AGENTCONTROL_AGENT_CODEX_CMD=${quoted(mockCommand)}`,
    `export MOCK_AGENT_SCRIPT=${quoted(spec.mockAgentScript)}`,
    ...(spec.version === undefined
      ? []
      : [`export AGENTCONTROL_RELAY_VERSION=${quoted(spec.version)}`]),
    `exec ${quoted(process.execPath)} ${quoted(relayMain)} "$@"`,
    "",
  ];
  await Bun.write(spec.path, lines.join("\n"));
  await chmod(spec.path, 0o755);
}
