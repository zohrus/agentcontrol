import type { SetupProgress } from "../setup/setup-progress.ts";

/**
 * The setup announced exactly these steps in this order, each written `<step>:<state>`, and the
 * last of them has arrived.
 */
export async function expectSetupToHaveAnnounced(
  progress: SetupProgress,
  expected: string[],
): Promise<void> {
  const last = expected.at(-1) ?? "";
  await progress.waitFor(
    (each) => `${each.step}:${each.state}` === last,
    `expected the setup to announce "${last}"`,
  );
  const announced = progress.entries.map((each) => `${each.step}:${each.state}`);
  if (announced.join(", ") === expected.join(", ")) return;
  throw new Error(
    `expected the setup to announce ${expected.join(", ")}, but it announced ${announced.join(", ")}`,
  );
}

/** The announcement of this step in this state says this (a failed step says why). */
export function expectAnnouncementToSay(
  progress: SetupProgress,
  call: { step: string; state: string; saying: string },
): void {
  const found = progress.entries.find(
    (each) => each.step === call.step && each.state === call.state,
  );
  if (found?.message.includes(call.saying)) return;
  const said = found === undefined ? "nothing" : `"${found.message}"`;
  throw new Error(
    `expected step "${call.step}" (${call.state}) to say "${call.saying}", but it said ${said}`,
  );
}

/** Each of these steps starting and then ending well: `["connect"]` is connect:started, connect:ok. */
export function startedAndThenOk(...steps: string[]): string[] {
  return steps.flatMap((step) => [`${step}:started`, `${step}:ok`]);
}
