/**
 * Phase 0 spike: drive a real ACP adapter and log every message.
 * Usage: bun spike/log-acp-events.ts claude|codex "<prompt>" [--cwd <dir>]
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { ClientConnection } from "@agentclientprotocol/sdk";
import { methods } from "@agentclientprotocol/sdk";
import { createLogger, logStream } from "./message-log.ts";
import { connectClient, initialize, runPrompt } from "./run-session.ts";
import { type AgentName, spawnAdapter } from "./spawn-adapter.ts";

type Args = { agent: AgentName; prompt: string; cwd: string };

function parseArgs(argv: string[]): Args {
  const [agent, prompt] = argv;
  const cwdFlag = argv.indexOf("--cwd");
  if ((agent !== "claude" && agent !== "codex") || !prompt) {
    throw new Error('usage: bun spike/log-acp-events.ts claude|codex "<prompt>" [--cwd <dir>]');
  }
  const cwd = cwdFlag >= 0 ? argv[cwdFlag + 1] : undefined;
  return { agent, prompt, cwd: resolve(cwd ?? mkdtempSync(join(tmpdir(), "acp-spike-"))) };
}

async function replayLoadedSession(conn: ClientConnection, args: Args, sessionId: string) {
  await conn.agent.request(methods.agent.session.load, {
    sessionId,
    cwd: args.cwd,
    mcpServers: [],
  });
}

async function drive(conn: ClientConnection, args: Args, note: (m: unknown) => void) {
  const init = await initialize(conn);
  note({ authMethods: init.authMethods, agentCapabilities: init.agentCapabilities });
  const session = await conn.agent.request(methods.agent.session.new, {
    cwd: args.cwd,
    mcpServers: [],
  });
  note({ stopReason: await runPrompt(conn, { sessionId: session.sessionId, prompt: args.prompt }) });
  if (init.agentCapabilities?.loadSession) {
    note({ trying: "session/load", sessionId: session.sessionId });
    await replayLoadedSession(conn, args, session.sessionId);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const log = createLogger(join(import.meta.dir, "logs", `${args.agent}-${stamp}.jsonl`));
  log("note", { agent: args.agent, cwd: args.cwd });
  const adapter = spawnAdapter(args.agent, args.cwd);
  const conn = connectClient(logStream(adapter.stream, log), log);
  try {
    await drive(conn, args, (m) => log("note", m));
  } catch (error) {
    log("note", { failed: error instanceof Error ? error.message : error, detail: error });
    process.exitCode = 1;
  } finally {
    conn.close();
    adapter.child.kill();
  }
}

await main();
