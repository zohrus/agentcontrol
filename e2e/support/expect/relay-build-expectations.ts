import { buildIdentity } from "@agentcontrol/protocol/build-id";
import type { AppAccess } from "../setup/app.ts";
import type { ApiOutcome } from "../setup/app-attempt.ts";
import { eventually } from "../setup/eventually.ts";
import type { RelayHost } from "../setup/relay-host.ts";
import { buildOfRelay } from "../setup/relay-peek.ts";

/** The relay answering now runs this checkout's code, eventually (the app replaced the old one). */
export function expectRelayToRunTheAppsCode(host: RelayHost): Promise<void> {
  return eventually("expected the relay to run the app's own code", async () => {
    const build = await buildOfRelay(host);
    return build === buildIdentity() ? undefined : `it runs build ${build ?? "unknown"}`;
  });
}

/** The relay answering now is still the one that runs this build: nothing replaced it. */
export async function expectRelayToStillRunBuild(host: RelayHost, build: string): Promise<void> {
  const now = await buildOfRelay(host);
  if (now !== build) {
    throw new Error(
      `expected the relay to be left running build ${build}, but it runs ${now ?? "unknown"}`,
    );
  }
}

/** A session is still working in the relay: it was not stopped under it. */
export async function expectASessionToStillBeWorking(app: AppAccess): Promise<void> {
  const rows = await app.sdk.sessions.list();
  if (!rows.some((row) => row.status === "running")) {
    throw new Error("expected a session to still be working in the relay, but none is");
  }
}

/** The session that was working is shown as interrupted, from which it can be resumed. */
export function expectTheWorkingSessionToBeInterrupted(app: AppAccess): Promise<void> {
  return eventually("expected the session that was working to be interrupted", async () => {
    const rows = await app.sdk.sessions.list();
    return rows.some((row) => row.status === "interrupted") ? undefined : "none is interrupted";
  });
}

/** The app said that the relay and the app disagree, in words that do not need zod to be read. */
export function expectTheRelayAndTheAppToBeSaidToDisagree(outcome: ApiOutcome<unknown>): void {
  if (outcome.ok) throw new Error("expected the app to refuse the request, but it went through");
  const { code, message } = outcome;
  if (code !== "relay-disagrees" || !readsPlainly(message)) {
    throw new Error(
      `expected a plain "relay and app disagree" refusal, but got ${code}: ${message}`,
    );
  }
}

/** Says that the two disagree and what to do, and has no zod issue list in it. */
function readsPlainly(message: string): boolean {
  const says = message.startsWith("The relay and the app disagree");
  return says && message.includes("Restart relay") && !message.includes("invalid_");
}

/** The technical detail, what the relay itself said, is still given apart from the message. */
export function expectTheRelaysOwnWordsToBeKept(
  outcome: ApiOutcome<unknown>,
  saying: string,
): void {
  const detail = outcome.ok ? undefined : (outcome.data as { detail?: string } | undefined)?.detail;
  if (!detail?.includes(saying)) {
    throw new Error(
      `expected the relay's own words (mentioning "${saying}") to be kept as detail, but got ${JSON.stringify(detail)}`,
    );
  }
}
