import type { ConnectionState } from "@agentcontrol/sdk";
import type { AppAccess } from "../setup/app.ts";
import type { ApiOutcome } from "../setup/app-attempt.ts";
import type { SilentRelay } from "../setup/silent-relay.ts";

const NOT_CONNECTED: ConnectionState[] = ["reconnecting", "offline"];

/** The live stream told the UI that the local workspace is no longer connected. */
export async function expectLiveStreamToReportTheLocalWorkspaceNotConnected(
  app: AppAccess,
): Promise<void> {
  await app.workspaceChanges.waitFor(
    (change) => change.id === "local" && NOT_CONNECTED.includes(change.state),
    "expected the live stream to report the local workspace as not connected",
  );
}

/** The relay has the request and has not answered it. */
export async function expectTheRelayToBeHoldingARequest(relay: SilentRelay): Promise<void> {
  await relay.held.waitFor(() => true, "expected the relay to be holding the request");
}

/** The refusal is the plain "relay unavailable" answer, with a message to read. */
export function expectRefusalToBeRelayUnavailable(outcome: ApiOutcome<unknown>): void {
  if (outcome.ok) {
    throw new Error("expected the app to say the relay is unavailable, but it answered");
  }
  if (outcome.status !== 503 || outcome.code !== "relay-unavailable" || outcome.message === "") {
    throw new Error(
      `expected a 503 "relay-unavailable" with a message, but got ${String(outcome.status)} "${outcome.code}" saying ${JSON.stringify(outcome.message)}`,
    );
  }
}

/** The refusal's data names the workspace that is down. */
export function expectRefusalToNameTheWorkspace(
  outcome: ApiOutcome<unknown>,
  workspaceId: string,
): void {
  const named = outcome.ok ? undefined : (outcome.data as { workspaceId?: string } | undefined);
  if (named?.workspaceId !== workspaceId) {
    throw new Error(
      `expected the refusal to name workspace "${workspaceId}", but it names ${String(named?.workspaceId)}`,
    );
  }
}
