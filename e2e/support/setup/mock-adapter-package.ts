import { join } from "node:path";
import type { FakePackage } from "./fake-registry.ts";

const mockAgentMain = join(import.meta.dir, "../mock-agent/main.ts");

/** The Claude Code adapter the relay pins (packages/relay/src/agents/adapters.ts). */
export const CLAUDE_ADAPTER = {
  name: "@agentclientprotocol/claude-agent-acp",
  version: "0.109.1",
  bin: "claude-agent-acp",
};

/** What the fake adapter runs: the scripted mock agent, so a session behaves as the test says. */
export const MOCK_ADAPTER_SOURCE = `await import(${JSON.stringify(mockAgentMain)});\n`;

/**
 * An adapter that runs the mock agent as a program of its own, started with `process.execPath`
 * as the Codex adapter starts its `codex.js`, and ends when that program ends.
 */
export const HELPER_PROGRAM_ADAPTER_SOURCE = `import { spawn } from "node:child_process";
const helper = spawn(process.execPath, [${JSON.stringify(mockAgentMain)}], { stdio: "inherit" });
helper.on("exit", (code) => process.exit(code ?? 0));
`;

/** The pinned Claude Code adapter as a package whose program is the mock agent. */
export function mockAdapterPackage(entrySource = MOCK_ADAPTER_SOURCE): FakePackage {
  return { ...CLAUDE_ADAPTER, entrySource };
}
