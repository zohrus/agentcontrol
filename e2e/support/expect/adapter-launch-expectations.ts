import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { RelayAccess, Session } from "../setup/relay.ts";
import { forSession } from "../setup/session-events.ts";
import { updatesOf } from "../setup/updates.ts";

function agentSaid(relay: RelayAccess, session: Session): string {
  return relay.events.entries
    .filter(forSession(session, "acp"))
    .flatMap(updatesOf)
    .flatMap((update) => (update.type === "agent-text" ? [update.text] : []))
    .join("");
}

/** The agent reported exactly this text (waits until it has said it). */
export async function expectAgentToHaveSaid(
  relay: RelayAccess,
  call: { session: Session; text: string },
): Promise<void> {
  const { session, text } = call;
  await relay.events.waitFor(
    (event) => forSession(session, "acp")(event) && agentSaid(relay, session).includes(text),
    `expected the agent of session "${session.title}" to say ${JSON.stringify(text)}`,
  );
}

/** The relay's adapter folder holds the adapter, and nothing half installed. */
export function expectAdapterInstalledWhole(relay: RelayAccess): void {
  const launchFiles = ["launch.js", "runtime"];
  const kept = readdirSync(join(relay.dataDir, "adapters")).filter(
    (name) => !launchFiles.includes(name),
  );
  if (kept.join(",") !== "claude-agent-acp@0.109.1") {
    throw new Error(
      `expected the relay's adapter folder to hold only claude-agent-acp@0.109.1, but it holds: ${kept.join(", ")}`,
    );
  }
}

/** A failed install left nothing in the relay's adapter folder. */
export function expectNothingInstalled(relay: RelayAccess): void {
  const kept = readdirSync(join(relay.dataDir, "adapters"));
  if (kept.length > 0) {
    throw new Error(
      `expected the failed install to leave the adapter folder empty, but it holds: ${kept.join(", ")}`,
    );
  }
}

/** The registry was asked for the adapter's package this many times. */
export function expectAdapterDownloadedTimes(
  call: { downloads: () => number },
  times: number,
): void {
  if (call.downloads() !== times) {
    throw new Error(
      `expected the adapter to be downloaded ${String(times)} time(s), but it was downloaded ${String(call.downloads())}`,
    );
  }
}
