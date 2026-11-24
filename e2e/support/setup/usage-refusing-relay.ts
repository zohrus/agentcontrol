import { spyOn } from "bun:test";
import { RelayName } from "@agentcontrol/protocol";
import { onTestEnd } from "./cleanup.ts";
import { relayRefusing } from "./refusing-relay.ts";
import type { Wire } from "./wire.ts";

const CANNOT_READ = "The usage of this session cannot be read.";

/** A connection to the relay on which every request for usage is answered with an error. */
export function aRelayThatCannotReadUsage(real: Wire): Wire {
  const refusal = { code: -32603, message: CANNOT_READ };
  return relayRefusing(real, (request) =>
    request.method === RelayName.usage ? refusal : undefined,
  );
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
