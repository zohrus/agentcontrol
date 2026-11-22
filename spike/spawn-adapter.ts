import { type ChildProcess, spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { ndJsonStream, type Stream } from "@agentclientprotocol/sdk";

export type AgentName = "claude" | "codex";

/** Exact adapter versions the spike was written against. */
const ADAPTER_COMMANDS: Record<AgentName, string[]> = {
  claude: ["bunx", "--bun", "@agentclientprotocol/claude-agent-acp@0.109.1"],
  codex: ["bunx", "--bun", "@agentclientprotocol/codex-acp@2.9.0"],
};

/** Environment variable that replaces the command, e.g. ACP_CLAUDE_CMD="/path/to/claude-agent-acp". */
function commandFor(agent: AgentName): string[] {
  const override = process.env[`ACP_${agent.toUpperCase()}_CMD`];
  return override ? override.split(" ") : ADAPTER_COMMANDS[agent];
}

export type Adapter = { child: ChildProcess; stream: Stream };

export function spawnAdapter(agent: AgentName, cwd: string): Adapter {
  const [command = "", ...args] = commandFor(agent);
  const child = spawn(command, args, { cwd, stdio: ["pipe", "pipe", "inherit"], env: process.env });
  const stream = ndJsonStream(Writable.toWeb(child.stdin), Readable.toWeb(child.stdout));
  return { child, stream };
}
