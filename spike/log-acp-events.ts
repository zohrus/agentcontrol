/**
 * Phase 0 spike: drive a real ACP adapter and log every message.
 * Usage: bun spike/log-acp-events.ts claude|codex "<prompt>" [--cwd <dir>] [--mode <modeId>] [--config <id>=<value>] [--timeout <s>]
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { ClientConnection } from "@agentclientprotocol/sdk";
import { methods } from "@agentclientprotocol/sdk";
import { createLogger, type Logger, logStream } from "./message-log.ts";
import { authenticateWithApiKey, connectClient, initialize, runPrompt } from "./run-session.ts";
import { type Adapter, type AgentName, spawnAdapter } from "./spawn-adapter.ts";

type Args = {
  agent: AgentName;
  prompt: string;
  cwd: string;
  mode: string | undefined;
  config: string | undefined;
  timeoutSeconds: number;
};

function flag(argv: string[], name: string): string | undefined {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : undefined;
}

const USAGE =
  'usage: bun spike/log-acp-events.ts claude|codex "<prompt>" [--cwd <dir>] [--mode <modeId>] [--config <id>=<value>] [--timeout <s>]';

function isAgentName(value: string | undefined): value is AgentName {
  return value === "claude" || value === "codex";
}

function parseArgs(argv: string[]): Args {
  const [agent, prompt] = argv;
  if (!isAgentName(agent) || !prompt) {
    throw new Error(USAGE);
  }
  const cwd = flag(argv, "--cwd") ?? mkdtempSync(join(tmpdir(), "acp-spike-"));
  return {
    agent,
    prompt,
    cwd: resolve(cwd),
    mode: flag(argv, "--mode"),
    config: flag(argv, "--config"),
    timeoutSeconds: Number(flag(argv, "--timeout") ?? 300),
  };
}

async function replayLoadedSession(conn: ClientConnection, args: Args, sessionId: string) {
  await conn.agent.request(methods.agent.session.load, {
    sessionId,
    cwd: args.cwd,
    mcpServers: [],
  });
}

async function applyMode(conn: ClientConnection, sessionId: string, modeId: string | undefined) {
  if (modeId === undefined) {
    return;
  }
  await conn.agent.request(methods.agent.session.setMode, { sessionId, modeId });
}

async function applyConfig(conn: ClientConnection, sessionId: string, config: string | undefined) {
  if (config === undefined) {
    return;
  }
  const [configId = "", value = ""] = config.split("=");
  await conn.agent.request(methods.agent.session.setConfigOption, { sessionId, configId, value });
}

async function applyOptions(conn: ClientConnection, args: Args, sessionId: string) {
  await applyMode(conn, sessionId, args.mode);
  await applyConfig(conn, sessionId, args.config);
}

async function drive(conn: ClientConnection, args: Args, note: (m: unknown) => void) {
  const init = await initialize(conn);
  note({ authMethods: init.authMethods, agentCapabilities: init.agentCapabilities });
  note({ authenticated: await authenticateWithApiKey(conn, init) });
  const session = await conn.agent.request(methods.agent.session.new, {
    cwd: args.cwd,
    mcpServers: [],
  });
  await applyOptions(conn, args, session.sessionId);
  note({
    stopReason: await runPrompt(conn, { sessionId: session.sessionId, prompt: args.prompt }),
  });
  if (init.agentCapabilities?.loadSession) {
    note({ trying: "session/load", sessionId: session.sessionId });
    await replayLoadedSession(conn, args, session.sessionId);
  }
}

function startWatchdog(args: Args, adapter: Adapter, log: Logger): NodeJS.Timeout {
  const giveUp = () => {
    log("note", { failed: `no result after ${String(args.timeoutSeconds)}s (see --timeout)` });
    adapter.child.kill();
    process.exit(1);
  };
  return setTimeout(giveUp, args.timeoutSeconds * 1000);
}

function openLog(agent: AgentName): Logger {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return createLogger(join(import.meta.dir, "logs", `${agent}-${stamp}.jsonl`));
}

async function runGuarded(conn: ClientConnection, args: Args, log: Logger) {
  try {
    await drive(conn, args, (m) => {
      log("note", m);
    });
  } catch (error) {
    log("note", { failed: error instanceof Error ? error.message : error, detail: error });
    process.exitCode = 1;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const log = openLog(args.agent);
  log("note", { agent: args.agent, cwd: args.cwd });
  const adapter = spawnAdapter(args.agent, args.cwd);
  const watchdog = startWatchdog(args, adapter, log);
  const conn = connectClient(logStream(adapter.stream, log), log);
  await runGuarded(conn, args, log);
  clearTimeout(watchdog);
  conn.close();
  adapter.child.kill();
}

await main();
