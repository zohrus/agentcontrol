import { spyOn } from "bun:test";
import { RelayName } from "@agentcontrol/protocol";
import { onTestEnd } from "./cleanup.ts";
import type { Wire } from "./wire.ts";

const CANNOT_READ = "The usage of this session cannot be read.";

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

/** A connection to the relay on which every request for usage is answered with an error. */
export function aRelayThatCannotReadUsage(real: Wire): Wire {
  const { output, say } = relayOutputPlus(real);
  return {
    ...real,
    output,
    send: (line) => {
      const message = JSON.parse(line) as { id?: number; method?: string };
      if (message.method !== RelayName.usage) {
        real.send(line);
        return;
      }
      const error = { code: -32603, message: CANNOT_READ };
      say(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, error })}\n`);
    },
  };
}

/** Records what the app writes to its error log until the test ends. */
export function theAppsErrorLog(): { lines(): string[] } {
  const logged: string[] = [];
  const spy = spyOn(console, "error").mockImplementation((...parts: unknown[]) => {
    logged.push(parts.map(String).join(" "));
  });
  onTestEnd(() => {
    spy.mockRestore();
    return Promise.resolve();
  });
  return { lines: () => logged };
}
