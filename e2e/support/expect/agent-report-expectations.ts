import { type EventSource, expectUpdate } from "./update-expectations.ts";

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
