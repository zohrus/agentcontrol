export interface SseMessage {
  event: string;
  data: string;
}

function parseBlock(block: string): SseMessage {
  const lines = block.split("\n");
  const valueOf = (field: string): string =>
    lines
      .filter((line) => line.startsWith(`${field}:`))
      .map((line) => line.slice(field.length + 1).trimStart())
      .join("\n");
  return { event: valueOf("event"), data: valueOf("data") };
}

/** Reads a server-sent-events body as it arrives, one message per blank-line-terminated block. */
export async function* sseMessages(body: ReadableStream<Uint8Array>): AsyncGenerator<SseMessage> {
  const decoder = new TextDecoder();
  let rest = "";
  for await (const chunk of body) {
    const blocks = (rest + decoder.decode(chunk, { stream: true }))
      .replaceAll("\r\n", "\n")
      .split("\n\n");
    rest = blocks.pop() ?? "";
    yield* blocks.filter((block) => block.trim() !== "").map(parseBlock);
  }
}
