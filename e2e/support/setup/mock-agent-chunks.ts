import type { Step } from "../mock-agent/script.ts";

type Chunks = { size: number; gapMs?: number };

/** Replies that arrive in pieces, as a model streams them. */
export interface ChunkedReplies {
  /** The agent replies with this text in chunks of `size` characters, `gapMs` apart (the mock agent waits, not the test). */
  willStreamReplyInChunks(text: string, chunks: Chunks): void;
  /** The agent thinks this text, in chunks of `size` characters. */
  willStreamThoughtInChunks(text: string, chunks: Chunks): void;
}

export function chunkedReplies(add: (step: Step) => void): ChunkedReplies {
  return {
    willStreamReplyInChunks: (text, chunks) => {
      add({ kind: "replyInChunks", text, ...chunks });
    },
    willStreamThoughtInChunks: (text, chunks) => {
      add({ kind: "thinkInChunks", text, ...chunks });
    },
  };
}
