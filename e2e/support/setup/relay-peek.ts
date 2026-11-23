import { RelayName, type SessionSummary } from "@agentcontrol/protocol";
import { connectToRelay } from "./relay-client.ts";
import type { RelayHost } from "./relay-host.ts";

/** The sessions the relay lists right now, read over a connection of their own (not the app's). */
export async function sessionsOfRelay(host: RelayHost): Promise<SessionSummary[]> {
  const client = connectToRelay(host.wire());
  try {
    return (await client.call(RelayName.sessionsList, {})).sessions;
  } finally {
    await client.disconnect();
  }
}
