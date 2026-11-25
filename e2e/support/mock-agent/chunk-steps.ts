// Steps that stream text the way a model does: in small chunks, with a short gap between them.
import { type Handler, send, type TurnContext } from "./turn.ts";

const GAP_MS_DEFAULT = 4;

function chunksOf(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let at = 0; at < text.length; at += size) chunks.push(text.slice(at, at + size));
  return chunks;
}

async function sendInChunks(
  turn: TurnContext,
  call: {
    kind: "agent_message_chunk" | "agent_thought_chunk";
    text: string;
    size: number;
    gapMs: number;
  },
): Promise<void> {
  const { kind, text, size, gapMs } = call;
  for (const chunk of chunksOf(text, size)) {
    await send(turn, { sessionUpdate: kind, content: { type: "text", text: chunk } });
    await Bun.sleep(gapMs);
  }
}

const replyInChunks: Handler<"replyInChunks"> = async (step, turn) => {
  const gapMs = step.gapMs ?? GAP_MS_DEFAULT;
  const { text, size } = step;
  await sendInChunks(turn, { kind: "agent_message_chunk", text, size, gapMs });
  return undefined;
};

const thinkInChunks: Handler<"thinkInChunks"> = async (step, turn) => {
  const gapMs = step.gapMs ?? GAP_MS_DEFAULT;
  const { text, size } = step;
  await sendInChunks(turn, { kind: "agent_thought_chunk", text, size, gapMs });
  return undefined;
};

export const chunkSteps = { replyInChunks, thinkInChunks };
