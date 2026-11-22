import type { AgentUpdate } from "@agentcontrol/protocol";
import { eventually } from "../setup/eventually.ts";
import { allUpdates } from "../setup/updates.ts";
import type { EventSource } from "./update-expectations.ts";

async function expectUpdate(
  source: EventSource,
  want: { describe: string; matches: (update: AgentUpdate) => boolean },
): Promise<void> {
  await eventually(`expected ${want.describe}`, async () => {
    const updates = allUpdates(await source());
    if (updates.some(want.matches)) return undefined;
    return `it arrived as: ${updates.map((update) => update.type).join(", ") || "no updates"}`;
  });
}

/** The agent's switch to this mode arrived as a `mode-changed` update. */
export function expectModeChangeAsUpdate(source: EventSource, modeId: string): Promise<void> {
  return expectUpdate(source, {
    describe: `the switch to mode "${modeId}" as a normalised update`,
    matches: (update) => update.type === "mode-changed" && update.modeId === modeId,
  });
}

/** A message the agent showed the user arrived as a `notice` update with this severity and text. */
export function expectNoticeAsUpdate(
  source: EventSource,
  notice: { severity: "info" | "warning" | "error"; text: string },
): Promise<void> {
  return expectUpdate(source, {
    describe: `the ${notice.severity} notice "${notice.text}" as a normalised update`,
    matches: (update) =>
      update.type === "notice" &&
      update.severity === notice.severity &&
      update.text === notice.text,
  });
}
