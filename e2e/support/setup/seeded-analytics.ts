import { mkdir } from "node:fs/promises";
import { join } from "node:path";

/** One permission request in a seeded turn, with when it was asked and answered (seconds into the session). */
interface SeededPermission {
  askedAtSec: number;
  answeredAtSec: number;
  answer: "allow" | "deny";
}

/** One turn of a seeded session; every time is in seconds after the session started. */
export interface SeededTurn {
  startsAtSec: number;
  endsAtSec: number;
  /** "end_turn" when left out. */
  stopReason?: string;
  model?: string;
  tokens?: { input: number; output: number; cacheRead: number; cacheWrite: number };
  /** The session's cost so far, as the agent reports it; left out for an agent that reports none. */
  costSoFarUsd?: number;
  permissions?: SeededPermission[];
  /** A file the agent edited in this turn. */
  edit?: { path: string; oldText: string; newText: string };
}

/** A session as it would sit in the relay's log, with timestamps the test chooses. */
export interface SeededSession {
  id: string;
  title: string;
  /** An ISO time: the session's first event. */
  startedAt: string;
  repoPath?: string;
  /** "mock" when left out. */
  agent?: "mock" | "claude-code" | "codex";
  turns: SeededTurn[];
}

interface Line {
  atSec: number;
  kind: string;
  payload: unknown;
}

const acp = (atSec: number, message: unknown): Line => ({
  atSec,
  kind: "acp",
  payload: { direction: "from-agent", message },
});

function permissionLines(turn: SeededTurn, index: number): Line[] {
  return (turn.permissions ?? []).flatMap((permission, n) => {
    const requestId = `request-${String(index)}-${String(n)}`;
    const options = [
      { optionId: "allow", name: "Allow", kind: "allow_once" },
      { optionId: "deny", name: "Deny", kind: "reject_once" },
    ];
    return [
      {
        atSec: permission.askedAtSec,
        kind: "permission-requested",
        payload: { requestId, toolCall: { title: "Run npm test", kind: "execute" }, options },
      },
      {
        atSec: permission.answeredAtSec,
        kind: "permission-answered",
        payload: { requestId, optionId: permission.answer === "allow" ? "allow" : "deny" },
      },
    ];
  });
}

function editLines(turn: SeededTurn, index: number): Line[] {
  if (turn.edit === undefined) return [];
  const { path, oldText, newText } = turn.edit;
  const update = {
    sessionUpdate: "tool_call",
    toolCallId: `edit-${String(index)}`,
    title: `Edit ${path}`,
    kind: "edit",
    status: "completed",
    content: [{ type: "diff", path, oldText, newText }],
  };
  return [
    acp(turn.startsAtSec + 1, { jsonrpc: "2.0", method: "session/update", params: { update } }),
  ];
}

const NO_TOKENS = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

/** The `usage_update` the agent sends before a turn ends: its cost so far and its model. */
function usageUpdate(turn: SeededTurn): unknown {
  const cost = turn.costSoFarUsd;
  return {
    sessionUpdate: "usage_update",
    used: 1,
    size: 200000,
    ...(cost === undefined ? {} : { cost: { amount: cost, currency: "USD" } }),
    _meta: { "_claude/model": turn.model },
  };
}

function usageLines(turn: SeededTurn, index: number): Line[] {
  const tokens = turn.tokens ?? NO_TOKENS;
  const usage = {
    inputTokens: tokens.input,
    outputTokens: tokens.output,
    cachedReadTokens: tokens.cacheRead,
    cachedWriteTokens: tokens.cacheWrite,
  };
  const result = { stopReason: turn.stopReason ?? "end_turn", usage };
  const update = usageUpdate(turn);
  return [
    acp(turn.endsAtSec - 0.2, { jsonrpc: "2.0", method: "session/update", params: { update } }),
    acp(turn.endsAtSec - 0.1, { jsonrpc: "2.0", id: index + 1, result }),
  ];
}

function turnLines(turn: SeededTurn, index: number): Line[] {
  return [
    {
      atSec: turn.startsAtSec,
      kind: "prompt-sent",
      payload: { text: `Prompt ${String(index + 1)}` },
    },
    ...editLines(turn, index),
    ...permissionLines(turn, index),
    ...usageLines(turn, index),
    {
      atSec: turn.endsAtSec,
      kind: "turn-ended",
      payload: { stopReason: turn.stopReason ?? "end_turn" },
    },
  ];
}

function opening(session: SeededSession): Line[] {
  const created = {
    agent: session.agent ?? "mock",
    repoPath: session.repoPath ?? "/repo",
    baseBranch: "main",
    branch: `agentcontrol/${session.id}`,
    worktreePath: `/worktrees/${session.id}`,
    title: session.title,
  };
  return [
    { atSec: -3, kind: "session-created", payload: created },
    { atSec: -2, kind: "setup-finished", payload: { exitCode: 0 } },
    { atSec: -1, kind: "agent-started", payload: {} },
  ];
}

function logOf(session: SeededSession): string {
  const lines = [...opening(session), ...session.turns.flatMap(turnLines)];
  const start = Date.parse(session.startedAt);
  const ordered = lines.toSorted((a, b) => a.atSec - b.atSec);
  return `${ordered
    .map((line, index) => {
      const ts = new Date(start + line.atSec * 1000).toISOString();
      return JSON.stringify({
        sessionId: session.id,
        seq: index + 1,
        ts,
        kind: line.kind,
        payload: line.payload,
      });
    })
    .join("\n")}\n`;
}

/** Writes these sessions' logs into a relay's data folder; the relay reads them the next time it starts. */
export async function writeSeededSessions(call: {
  relayDataDir: string;
  sessions: SeededSession[];
}): Promise<void> {
  await Promise.all(
    call.sessions.map(async (session) => {
      const dir = join(call.relayDataDir, "sessions", session.id);
      await mkdir(dir, { recursive: true });
      await Bun.write(join(dir, "events.jsonl"), logOf(session));
    }),
  );
}
