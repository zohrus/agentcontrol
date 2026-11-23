import type { RunningApp } from "../setup/start-app.ts";
import type { StartOutcome } from "../setup/app-start-failure.ts";
import { eventually } from "../setup/eventually.ts";

/** The app keeps answering, but says the relay is unavailable. */
export async function expectAppToSayTheRelayIsUnavailable(app: RunningApp): Promise<void> {
  await eventually("expected the app to say the relay is unavailable", async () => {
    const outcome = await app.user.triesToListTheAgents();
    if (outcome.ok) return "it still answers";
    return outcome.code === "relay-unavailable" ? undefined : `it says "${outcome.code}"`;
  });
}

/** The app tried to reach the relay again while it was down, and that attempt failed. */
export async function expectAppToHaveFailedToReconnect(app: RunningApp): Promise<void> {
  await app.relayConnectionsEnded.waitFor(
    (ended) => ended >= 2,
    "expected the app to try the relay again while it was down",
  );
}

/** The app found the relay again on its own and answers once more. */
export async function expectAppToAnswerAgain(app: RunningApp): Promise<void> {
  await eventually("expected the app to answer again once the relay is back", async () => {
    const outcome = await app.user.triesToListTheAgents();
    return outcome.ok ? undefined : `it says "${outcome.code}"`;
  });
}

/** The app did not start, and gave a reason. */
export function expectAppToHaveRefusedToStart(outcome: StartOutcome): void {
  if (outcome.started) throw new Error("expected the app to refuse to start, but it started");
  if (outcome.reason === "")
    throw new Error("expected the app to say why it did not start, but it said nothing");
}
