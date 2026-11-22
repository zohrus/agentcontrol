import type { EventSource } from "./update-expectations.ts";

// The one expectations file that reads raw ACP on purpose: it proves the relay keeps the raw
// message unchanged. scripts/acp-leaks.ts allows it by name; no other expectation may read raw ACP.

/** Every `acp` event keeps its raw message next to the normalised updates. */
export async function expectRawMessagesKeptNextToUpdates(source: EventSource): Promise<void> {
  const acp = (await source()).filter((event) => event.kind === "acp");
  const bare = acp.filter((event) => event.payload.updates === undefined);
  if (acp.length === 0 || bare.length > 0) {
    throw new Error(
      `expected every ACP event to hold its raw message and its updates, but ${String(bare.length)} of ${String(acp.length)} had no updates`,
    );
  }
}

/** The raw message of an agent reply is the exact message the agent sent, beside its update. */
export async function expectRawReplyUnchanged(
  source: EventSource,
  call: { text: string },
): Promise<void> {
  const wanted = {
    jsonrpc: "2.0",
    method: "session/update",
    params: {
      sessionId: "mock-session-1",
      update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: call.text } },
    },
  };
  const events = await source();
  const reply = events.find(
    (event) =>
      event.kind === "acp" && JSON.stringify(event.payload.message) === JSON.stringify(wanted),
  );
  if (reply?.kind !== "acp") {
    throw new Error(
      `expected the raw ACP message of the reply "${call.text}" to be kept unchanged`,
    );
  }
  if (!reply.payload.updates?.some((update) => update.type === "agent-text")) {
    throw new Error(
      `expected the kept raw message of "${call.text}" to carry its normalised update`,
    );
  }
}
