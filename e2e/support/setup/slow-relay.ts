import { Timeline } from "./timeline.ts";
import type { Wire } from "./wire.ts";

const HELD_WAIT_MS = 5000;
/** JSON-RPC's "invalid params": what the relay answers when it refuses a request. */
const REFUSED = -32602;

/** A relay that is slow to answer some requests: the app's requests wait until the test lets them go. */
export interface SlowRelay {
  /** Wraps the app's connection to the relay; pass it as `relayWire`. */
  readonly wire: (real: Wire) => Wire;
  /** The method of each request taken and held back so far. */
  readonly held: Timeline<string>;
  /** Sends every held request on, and stops holding any. */
  answers(): void;
  /** Answers every held request with a refusal saying `message`, and stops holding any. */
  refuses(message: string): void;
  /** Holds the requests again, after `answers()` let some go. */
  holdsAgain(): void;
}

/** One request held back: how to send it on, and its id so it can be refused instead. */
interface Held {
  id: unknown;
  sendOn: () => void;
}

/** A connection whose output the test can add lines to, besides what the relay says. */
function withInjectedOutput(real: Wire): { wire: Wire; inject: (line: string) => void } {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const output = new ReadableStream<Uint8Array>({
    async start(started) {
      controller = started;
      for await (const chunk of real.output) started.enqueue(chunk);
      started.close();
    },
  });
  return {
    wire: { ...real, output },
    inject: (line) => {
      controller?.enqueue(encoder.encode(`${line}\n`));
    },
  };
}

/** Takes the requests with the given methods and keeps them until they are released. */
function requestsHeldBack(methods: string[], held: Timeline<string>) {
  const waiting: Held[] = [];
  let open = false;
  return {
    offer: (line: string, real: Wire): void => {
      const { id, method } = JSON.parse(line) as { id?: unknown; method?: string };
      if (open || method === undefined || !methods.includes(method)) {
        real.send(line);
        return;
      }
      waiting.push({
        id,
        sendOn: () => {
          real.send(line);
        },
      });
      held.record(method);
    },
    /** What was held, and from now on nothing is. */
    release: (): Held[] => {
      open = true;
      return waiting.splice(0);
    },
    holdAgain: (): void => {
      open = false;
    },
  };
}

/** The relay does not get the requests with these methods until `answers()` (or `refuses()`). */
export function aRelayThatIsSlowToAnswer(...methods: string[]): SlowRelay {
  const held = new Timeline<string>(HELD_WAIT_MS);
  const requests = requestsHeldBack(methods, held);
  let inject: (line: string) => void = () => undefined;
  const wire = (real: Wire): Wire => {
    const injected = withInjectedOutput(real);
    inject = injected.inject;
    return {
      ...injected.wire,
      send: (line) => {
        requests.offer(line, real);
      },
    };
  };
  return {
    wire,
    held,
    answers: () => {
      for (const request of requests.release()) request.sendOn();
    },
    holdsAgain: requests.holdAgain,
    refuses: (message) => {
      for (const { id } of requests.release()) {
        inject(JSON.stringify({ jsonrpc: "2.0", id, error: { code: REFUSED, message } }));
      }
    },
  };
}
