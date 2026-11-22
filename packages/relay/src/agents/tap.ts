import type { Stream } from "@agentclientprotocol/sdk";
import type { MessageDirection } from "./types.ts";

type Tap = (direction: MessageDirection, message: unknown) => void;

/** Wraps a stream so every message passing through, in either direction, is reported unchanged. */
export function tapStream(stream: Stream, tap: Tap): Stream {
  const writer = stream.writable.getWriter();
  const writable = new WritableStream<Parameters<typeof writer.write>[0]>({
    write(message) {
      tap("to-agent", message);
      return writer.write(message);
    },
    close: () => writer.close(),
    abort: (reason) => writer.abort(reason),
  });
  const readable = stream.readable.pipeThrough(
    new TransformStream({
      transform(message, controller) {
        tap("from-agent", message);
        controller.enqueue(message);
      },
    }),
  );
  return { readable, writable };
}
