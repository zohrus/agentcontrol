import type { Wire } from "./wire.ts";

/** What a connection sends the relay, as far as a refusing relay needs to read it. */
export interface Request {
  method?: string;
  params?: object;
}

/** The error a refusing relay answers with. */
export interface Refusal {
  code: number;
  message: string;
}

/** Copies what the relay says onto a stream the caller can add to as well. */
function relayOutputPlus(real: Wire): {
  output: ReadableStream<Uint8Array>;
  say: (line: string) => void;
} {
  let say: (line: string) => void = () => undefined;
  const output = new ReadableStream<Uint8Array>({
    start(controller) {
      say = (line) => {
        controller.enqueue(new TextEncoder().encode(line));
      };
      const reader = real.output.getReader();
      void (async () => {
        for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
          controller.enqueue(chunk.value);
        }
        controller.close();
      })();
    },
  });
  return {
    output,
    say: (line) => {
      say(line);
    },
  };
}

/**
 * A connection to the relay on which every request `refusal` returns an error for is answered with
 * that error, by this wire and not by the relay; every other request goes to the relay.
 */
export function relayRefusing(
  real: Wire,
  refusal: (request: Request) => Refusal | undefined,
): Wire {
  const { output, say } = relayOutputPlus(real);
  return {
    ...real,
    output,
    send: (line) => {
      const message = JSON.parse(line) as Request & { id?: number };
      const error = refusal(message);
      if (error === undefined) {
        real.send(line);
        return;
      }
      say(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, error })}\n`);
    },
  };
}
