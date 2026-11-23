import { join } from "node:path";
import type { Session } from "./relay.ts";
import { SHELL_RELAY_ENV } from "./start-app-with-shell.ts";
import { type RunningRelay, startRelayWithLocalRepo } from "./start-relay.ts";

/** A relay with a session, and the name of the file a flooding command creates when it is done. */
export async function aRelayWithASessionToFlood(): Promise<{
  relay: RunningRelay;
  session: Session;
  doneFile: string;
}> {
  const relay = await startRelayWithLocalRepo({ env: SHELL_RELAY_ENV });
  const session = await relay.user.startsSession({ prompt: "Add rate limiting" });
  return { relay, session, doneFile: join(relay.dataDir, "flood-done") };
}
