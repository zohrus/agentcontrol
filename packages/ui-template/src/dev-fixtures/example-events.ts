import { SessionEvent } from "@agentcontrol/protocol";

/** EXAMPLE DATA: the relay event log of a session that is waiting for a permission answer. */
const sessionId = "example-rate-limit";

function acp(update: Record<string, unknown>) {
  const message = { jsonrpc: "2.0", method: "session/update", params: { sessionId, update } };
  return { kind: "acp", payload: { direction: "from-agent", message } };
}

function text(sessionUpdate: string, chunk: string, messageId: string) {
  return acp({ sessionUpdate, messageId, content: { type: "text", text: chunk } });
}

const edit = (id: string, path: string, newText: string) => [
  acp({ sessionUpdate: "tool_call", toolCallId: id, title: "Edit " + path, kind: "edit" }),
  acp({
    sessionUpdate: "tool_call_update",
    toolCallId: id,
    status: "completed",
    locations: [{ path }],
    content: [{ type: "diff", path, oldText: null, newText }],
  }),
];

const rawEvents = [
  {
    kind: "session-created",
    payload: {
      agent: "claude-code",
      repoPath: "~/api",
      baseBranch: "main",
      branch: "agent/rate-limit",
      worktreePath: "/Users/dev/.agentcontrol/worktrees/rate-limit",
      title: "Rate limit API",
    },
  },
  { kind: "setup-output", payload: { stream: "stdout", text: "Copying .env files\n" } },
  { kind: "setup-output", payload: { stream: "stdout", text: "npm install: done in 4.1s\n" } },
  { kind: "setup-finished", payload: { exitCode: 0 } },
  { kind: "agent-started", payload: {} },
  {
    kind: "prompt-sent",
    payload: { text: "Add per-API-key rate limiting to the public API, 100 req/min, with a test." },
  },
  text("agent_thought_chunk", "Express app with no limiter yet. ", "t1"),
  text(
    "agent_thought_chunk",
    "A sliding window in Redis fits, since Redis is already a dependency.",
    "t1",
  ),
  acp({
    sessionUpdate: "plan",
    entries: [
      { content: "Find the request pipeline", status: "completed", priority: "high" },
      { content: "Add rateLimit middleware", status: "completed", priority: "high" },
      { content: "Write tests and run them", status: "in_progress", priority: "medium" },
    ],
  }),
  acp({ sessionUpdate: "tool_call", toolCallId: "c1", title: "Read src/server.ts", kind: "read" }),
  acp({
    sessionUpdate: "tool_call_update",
    toolCallId: "c1",
    status: "completed",
    locations: [{ path: "src/server.ts" }],
  }),
  text("agent_message_chunk", "I found the pipeline in server.ts. ", "m1"),
  text("agent_message_chunk", "Adding a middleware before the router.", "m1"),
  ...edit("c2", "src/middleware/rateLimit.ts", "const WINDOW_MS = 60_000;\nconst LIMIT = 100;\n"),
  ...edit(
    "c3",
    "test/rateLimit.test.ts",
    'import { test } from "bun:test";\ntest("limits", () => {});\n',
  ),
  {
    kind: "permission-requested",
    payload: {
      requestId: "req-1",
      toolCall: { title: "Run npm test -- rateLimit" },
      options: [
        { optionId: "allow", name: "Allow once", kind: "allow_once" },
        { optionId: "always", name: "Always allow npm test", kind: "allow_always" },
        { optionId: "reject", name: "Deny", kind: "reject_once" },
      ],
    },
  },
];

const start = Date.parse("2026-11-22T09:00:00Z");

export const exampleEvents: SessionEvent[] = rawEvents.map((event, index) =>
  SessionEvent.parse({
    ...event,
    sessionId,
    seq: index + 1,
    ts: new Date(start + index * 4000).toISOString(),
  }),
);
