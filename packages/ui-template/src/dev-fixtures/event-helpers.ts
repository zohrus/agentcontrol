import { SessionEvent } from "@agentcontrol/protocol";

type Update = Record<string, unknown>;

/** Builders for the raw events of one example session. */
export function eventKit(sessionId: string) {
  const acp = (update: Update) => {
    const message = { jsonrpc: "2.0", method: "session/update", params: { sessionId, update } };
    return { kind: "acp", payload: { direction: "from-agent", message } };
  };
  const text = (sessionUpdate: string, chunk: string, messageId: string) =>
    acp({ sessionUpdate, messageId, content: { type: "text", text: chunk } });
  const read = (id: string, path: string, kind = "read") => [
    acp({ sessionUpdate: "tool_call", toolCallId: id, title: `Read ${path}`, kind }),
    acp({
      sessionUpdate: "tool_call_update",
      toolCallId: id,
      status: "completed",
      locations: [{ path }],
    }),
  ];
  const edit = (id: string, path: string, newText: string) => [
    acp({ sessionUpdate: "tool_call", toolCallId: id, title: `Edit ${path}`, kind: "edit" }),
    acp({
      sessionUpdate: "tool_call_update",
      toolCallId: id,
      status: "completed",
      locations: [{ path }],
      content: [{ type: "diff", path, oldText: null, newText }],
    }),
  ];
  return { acp, text, read, edit };
}

/** Numbers the raw events from 1, four seconds apart from `start`, and validates them. */
export function toEvents(sessionId: string, raw: readonly object[], start: string): SessionEvent[] {
  return raw.map((event, index) =>
    SessionEvent.parse({
      ...event,
      sessionId,
      seq: index + 1,
      ts: new Date(Date.parse(start) + index * 4000).toISOString(),
    }),
  );
}
